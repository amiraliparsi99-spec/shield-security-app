import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type StaffRequirement = {
  role: string;
  quantity: number;
  rate: number;
};

type TemplateResponse = {
  name: string;
  eventType: string;
  staffRequirements: StaffRequirement[];
  briefNotes: string;
};

const systemPrompt = `You are an AI assistant for Shield, a security staffing platform. Your job is to generate event security templates based on user descriptions.

When given an event description, analyze it and return a JSON object with:
- name: A short, descriptive template name
- eventType: One of "Regular Night", "Special Event", "Private Hire", "Concert/Live Music", "Corporate Event"
- staffRequirements: An array of staff requirements, each with:
  - role: One of "Door Security", "Floor Security", "VIP Security", "Event Security", "CCTV Operator", "Supervisor"
  - quantity: Number of staff needed (be realistic based on event size)
  - rate: Hourly rate in GBP (Door: 18, Floor: 16, VIP: 22, Event: 16, CCTV: 17, Supervisor: 25)
- briefNotes: Professional briefing notes for security staff (2-3 sentences covering dress code, special requirements, key focus areas)

Consider:
- Event size/capacity mentioned
- Event type (club, concert, corporate, private, etc.)
- VIP requirements
- Special security needs
- Time of day/week

Respond ONLY with valid JSON, no explanation.`;

async function generateWithOpenAI(prompt: string): Promise<TemplateResponse | null> {
  if (!OPENAI_API_KEY) return null;
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a security template for: ${prompt}` },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) throw new Error("OpenAI API error");

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TemplateResponse;
      }
    }
  } catch (error) {
    console.error("OpenAI error:", error);
  }
  
  return null;
}

async function generateWithAnthropic(prompt: string): Promise<TemplateResponse | null> {
  if (!ANTHROPIC_API_KEY) return null;
  
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Generate a security template for: ${prompt}` },
        ],
      }),
    });

    if (!response.ok) throw new Error("Anthropic API error");

    const data = await response.json();
    const content = data.content?.[0]?.text;
    
    if (content) {
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TemplateResponse;
      }
    }
  } catch (error) {
    console.error("Anthropic error:", error);
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Try OpenAI first, then Anthropic
    let template = await generateWithOpenAI(prompt);
    
    if (!template) {
      template = await generateWithAnthropic(prompt);
    }

    if (!template) {
      // No API keys configured - return null so client uses fallback
      return NextResponse.json(
        { template: null, fallback: true },
        { status: 200 }
      );
    }

    // Validate the response
    if (!template.name || !template.staffRequirements || !Array.isArray(template.staffRequirements)) {
      return NextResponse.json(
        { template: null, fallback: true },
        { status: 200 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Template generation error:", error);
    return NextResponse.json(
      { template: null, fallback: true },
      { status: 200 }
    );
  }
}
