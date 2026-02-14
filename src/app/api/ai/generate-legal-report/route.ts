import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ——— Environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ——— Types
type IncidentType =
  | "Ejection"
  | "Assault"
  | "Theft"
  | "Drug-Related"
  | "Trespass"
  | "Verbal Altercation"
  | "Medical Emergency"
  | "Property Damage"
  | "Weapons"
  | "Other";

type LiabilityRisk = "Low" | "Medium" | "High";

interface GenerateLegalReportRequest {
  raw_text: string;
  incident_type: IncidentType;
  venue_name: string;
  guard_name: string;
}

interface LegalReportResponse {
  /** The polished, court-ready text */
  professional_report: string;
  /** A short 1-sentence summary for the dashboard */
  executive_summary: string;
  /** Assessment of legal risk based on the description */
  liability_risk_score: LiabilityRisk;
  /** Specific laws cited (e.g., "Trespass", "Licensing Act 2003") */
  legal_citations: string[];
  /** Questions to ask the guard if the report is vague */
  missing_critical_info: string[];
}

// ——— System Prompt Builder
function buildSIALawyerPrompt(
  venue_name: string,
  guard_name: string,
  incident_type: string
): string {
  return `You are an expert UK Security Consultant and Legal Analyst specialising in liability defence for the Nighttime Economy.
Your task is to rewrite raw testimony from a security operative into a formal **Incident Report** suitable for insurance claims and court proceedings.

**Transformation Rules:**
1. **Professionalise:** Change slang to professional terminology (e.g., 'drunk' → 'intoxicated', 'kicked him out' → 'escorted from premises', 'grabbed him' → 'applied approved physical intervention technique', 'fight' → 'physical altercation', 'bouncer' → 'SIA-licensed door supervisor', 'punched' → 'struck with a closed fist', 'rowdy' → 'displaying antisocial behaviour').
2. **Legal Framing:** Explicitly highlight **De-escalation attempts** (verbal warnings, body language). If the user implies force was used, frame it as 'Proportionate, Legal, and Necessary' under Common Law and Section 3 of the Criminal Law Act 1967. Reference the Private Security Industry Act 2001 where applicable.
3. **Objectivity:** Remove emotional language. Stick to observable facts (actions, times, locations). Use third-person passive voice where appropriate.
4. **Gap Analysis:** If the user's story is missing critical legal details (e.g., 'Did you warn them before touching them?', 'Were CCTV cameras covering the area?', 'Were witnesses present?'), flag these in the 'missing_critical_info' field.
5. **Structure:** The professional_report should follow a chronological narrative: Setting/Context → Initial Contact → Escalation → Intervention → Resolution → Post-Incident Actions.

**Input Context:**
- Venue: ${venue_name}
- Operative: ${guard_name}
- Incident Type: ${incident_type}

**You MUST respond with valid JSON only** matching this exact schema:
{
  "professional_report": "string — The polished, court-ready incident report text",
  "executive_summary": "string — A single sentence summary for dashboard display",
  "liability_risk_score": "Low | Medium | High",
  "legal_citations": ["array of relevant UK law references"],
  "missing_critical_info": ["array of follow-up questions for the operative"]
}

Do not include any text outside the JSON object.`;
}

// ——— POST Handler
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // --- Auth ---
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    let userId: string | null = null;
    const key =
      supabaseServiceKey &&
      supabaseServiceKey !== "YOUR_SERVICE_ROLE_KEY_HERE"
        ? supabaseServiceKey
        : supabaseAnonKey;
    const supabase = createClient(supabaseUrl, key);

    if (token) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch {
        // Continue without user — non-blocking
      }
    }

    // --- Validate Body ---
    const body = await request.json();
    const { raw_text, incident_type, venue_name, guard_name } =
      body as GenerateLegalReportRequest;

    if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length === 0) {
      return NextResponse.json(
        { error: "raw_text is required and must be a non-empty string" },
        { status: 400 }
      );
    }
    if (!incident_type || typeof incident_type !== "string") {
      return NextResponse.json(
        { error: "incident_type is required" },
        { status: 400 }
      );
    }
    if (!venue_name || typeof venue_name !== "string") {
      return NextResponse.json(
        { error: "venue_name is required" },
        { status: 400 }
      );
    }
    if (!guard_name || typeof guard_name !== "string") {
      return NextResponse.json(
        { error: "guard_name is required" },
        { status: 400 }
      );
    }

    // --- Guard: OpenAI key ---
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured on the server" },
        { status: 503 }
      );
    }

    // --- Build prompt & call OpenAI ---
    const systemPrompt = buildSIALawyerPrompt(venue_name, guard_name, incident_type);

    const userMessage = `Here is the raw testimony from the security operative. Rewrite it into a professional Incident Report:\n\n"""${raw_text}"""`;

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.4, // Low temp for factual / legal precision
          max_tokens: 2000,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errBody);
      return NextResponse.json(
        { error: "AI service returned an error. Please try again." },
        { status: 502 }
      );
    }

    const openaiData = await openaiResponse.json();
    const rawContent = openaiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: "AI returned an empty response" },
        { status: 502 }
      );
    }

    // --- Parse & validate the structured response ---
    let report: LegalReportResponse;
    try {
      const parsed = JSON.parse(rawContent);

      report = {
        professional_report: parsed.professional_report || "",
        executive_summary: parsed.executive_summary || "",
        liability_risk_score: validateRiskScore(parsed.liability_risk_score),
        legal_citations: Array.isArray(parsed.legal_citations)
          ? parsed.legal_citations
          : [],
        missing_critical_info: Array.isArray(parsed.missing_critical_info)
          ? parsed.missing_critical_info
          : [],
      };

      if (!report.professional_report) {
        throw new Error("professional_report is empty");
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr, rawContent);
      return NextResponse.json(
        { error: "Failed to parse AI response into structured report" },
        { status: 502 }
      );
    }

    // --- Save to Supabase (incidents table) ---
    let savedIncidentId: string | null = null;

    try {
      const incidentRecord = {
        user_id: userId,
        venue_name,
        guard_name,
        incident_type,
        raw_text,
        professional_report: report.professional_report,
        executive_summary: report.executive_summary,
        liability_risk_score: report.liability_risk_score,
        legal_citations: report.legal_citations,
        missing_critical_info: report.missing_critical_info,
        model_used: "gpt-4o",
        tokens_used: openaiData.usage?.total_tokens || 0,
        processing_time_ms: Date.now() - startTime,
        created_at: new Date().toISOString(),
      };

      const { data: insertData, error: insertError } = await supabase
        .from("incidents")
        .insert(incidentRecord)
        .select("id")
        .single();

      if (insertError) {
        // Log but don't fail the request — the report was still generated
        console.error("Failed to save incident to database:", insertError.message);
      } else {
        savedIncidentId = insertData?.id || null;
      }
    } catch (dbError) {
      console.error("Database error when saving incident:", dbError);
    }

    // --- Return the report ---
    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      report,
      metadata: {
        incident_id: savedIncidentId,
        model_used: "gpt-4o",
        tokens_used: openaiData.usage?.total_tokens || 0,
        processing_time_ms: responseTime,
      },
    });
  } catch (error) {
    console.error("Legal report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate legal report" },
      { status: 500 }
    );
  }
}

// ——— Helpers

function validateRiskScore(value: unknown): LiabilityRisk {
  if (value === "Low" || value === "Medium" || value === "High") {
    return value;
  }
  // Default to Medium if AI returns something unexpected
  return "Medium";
}
