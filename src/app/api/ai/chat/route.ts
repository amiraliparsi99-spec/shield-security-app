import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SECURITY_SYSTEM_PROMPT,
  buildUserContext,
  formatContextForAI,
  AIMessage,
  type UserContext,
} from "@/lib/ai/shield-ai";
import { getRelevantKnowledge, KnowledgeDocument } from "@/lib/ai/knowledge-base";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Default to Claude Sonnet 4.6 (best balance of quality + speed). Set
// ANTHROPIC_MODEL=claude-haiku-4-5 for a cheaper/faster option.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

/**
 * Convert our internal message list into the shape Anthropic's Messages API
 * expects: only user/assistant roles, and the first message MUST be a user
 * message (so we drop any leading assistant greeting).
 */
function toAnthropicMessages(
  messages: Array<{ role: string; content: string }>
): Array<{ role: "user" | "assistant"; content: string }> {
  const mapped = messages
    .filter((m) => m.role !== "system" && m.content?.trim())
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  // Drop leading assistant messages — the conversation must start with user.
  while (mapped.length && mapped[0].role === "assistant") {
    mapped.shift();
  }
  return mapped;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Get request body - support both formats
    const body = await request.json();
    
    // Support both {messages: [{role, content}]} and {message: string, conversationHistory: []}
    let messages: Array<{role: string, content: string}>;
    let role: string;
    let sessionId: string | undefined;
    
    if (body.messages && Array.isArray(body.messages)) {
      // New format
      messages = body.messages;
      role = body.role || "venue";
      sessionId = body.sessionId;
    } else if (body.message) {
      // Legacy format from ShieldAI component
      const conversationHistory = body.conversationHistory || [];
      messages = [
        ...conversationHistory.map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: body.message }
      ];
      role = body.userRole || "venue";
      sessionId = body.sessionId;
    } else {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }
    
    // Try to verify user if we have a token
    let userId: string | null = null;
    let supabase;
    
    if (token) {
      // Use service key if available, otherwise anon key
      const key = supabaseServiceKey && supabaseServiceKey !== "YOUR_SERVICE_ROLE_KEY_HERE" 
        ? supabaseServiceKey 
        : supabaseAnonKey;
      
      supabase = createClient(supabaseUrl, key);
      
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch {
        // Continue without user context
      }
    } else {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
    }

    const userMessage = messages[messages.length - 1]?.content || "";
    const session = sessionId || crypto.randomUUID();

    // Build user context from their data (if we have a user)
    const effectiveRole = (role || "personnel") as UserContext["role"];
    const userContext: UserContext = userId
      ? await buildUserContext(userId, effectiveRole)
      : { role: effectiveRole };

    // === RAG: Get relevant knowledge ===
    const relevantKnowledge = getRelevantKnowledge(userMessage, role || "personnel", 3);
    
    // Format knowledge for context
    let knowledgeContext = "";
    if (relevantKnowledge.length > 0) {
      knowledgeContext = "\n\n[RELEVANT KNOWLEDGE FROM SHIELD DATABASE]\n";
      relevantKnowledge.forEach((doc, i) => {
        knowledgeContext += `\n--- Source ${i + 1}: ${doc.title} (${doc.source || 'Shield'}) ---\n`;
        knowledgeContext += doc.content + "\n";
      });
      knowledgeContext += "\n[END KNOWLEDGE]\n\nUse the above knowledge to provide accurate, specific answers. Cite sources when relevant.";
    }

    const contextString = formatContextForAI(userContext);

    // Prepare messages for AI
    const systemMessage = SECURITY_SYSTEM_PROMPT + contextString + knowledgeContext;
    
    const aiMessages: AIMessage[] = [
      { role: "system", content: systemMessage },
      ...messages.slice(-10).map((m) => ({
        role: m.role as AIMessage["role"],
        content: m.content,
      })),
    ];

    let aiResponse: string = "";
    let tokensUsed = 0;
    let modelUsed = "fallback";

    // === Primary provider: Anthropic Claude ===
    if (ANTHROPIC_API_KEY) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 1500,
            temperature: 0.5,
            system: systemMessage,
            messages: toAnthropicMessages(messages.slice(-10)),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = Array.isArray(data.content)
            ? data.content
                .filter((b: { type?: string }) => b.type === "text")
                .map((b: { text?: string }) => b.text || "")
                .join("\n")
                .trim()
            : "";
          aiResponse = text || generateFallbackResponse(userMessage, userContext, relevantKnowledge);
          tokensUsed =
            (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
          modelUsed = ANTHROPIC_MODEL;
        } else {
          const errBody = await response.text();
          console.error(`Anthropic API error (${response.status}): ${errBody}`);
          aiResponse = generateFallbackResponse(userMessage, userContext, relevantKnowledge);
        }
      } catch (e) {
        console.error("Anthropic request failed:", e);
        aiResponse = generateFallbackResponse(userMessage, userContext, relevantKnowledge);
      }
    } else if (OPENAI_API_KEY) {
      // === Secondary fallback provider: OpenAI ===
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: aiMessages,
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiResponse = data.choices[0]?.message?.content || generateFallbackResponse(userMessage, userContext, relevantKnowledge);
          tokensUsed = data.usage?.total_tokens || 0;
          modelUsed = "gpt-4o-mini";
        } else {
          aiResponse = generateFallbackResponse(userMessage, userContext, relevantKnowledge);
        }
      } catch {
        aiResponse = generateFallbackResponse(userMessage, userContext, relevantKnowledge);
      }
    } else {
      // === No provider configured: knowledge-base fallback ===
      aiResponse = generateFallbackResponse(userMessage, userContext, relevantKnowledge);
    }

    const responseTime = Date.now() - startTime;

    // === Log conversation for Phase 3 training data (only if we have a user) ===
    if (userId && supabase) {
      try {
        await supabase.from("ai_conversations").insert({
          user_id: userId,
          user_role: role || "personnel",
          session_id: session,
          message: userMessage,
          response: aiResponse,
          context_used: relevantKnowledge.map(k => ({ title: k.title, category: k.category })),
          model_used: modelUsed,
          tokens_used: tokensUsed,
          response_time_ms: responseTime,
        });

        // Track common questions (RPC may not exist in DB)
        try {
          await supabase.rpc("track_ai_question", {
            question_text: userMessage,
            generated_answer: aiResponse,
          });
        } catch {
          /* ignore */
        }
      } catch (e) {
        // Don't fail the request if logging fails
        console.error("Failed to log AI conversation:", e);
      }
    }

    return NextResponse.json({
      message: aiResponse,
      context: userContext,
      sessionId: session,
      sources: relevantKnowledge.map(k => ({ title: k.title, category: k.category })),
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// Fallback responses using knowledge base
function generateFallbackResponse(
  query: string, 
  context: any, 
  knowledge: KnowledgeDocument[]
): string {
  // If we have relevant knowledge, use it
  if (knowledge.length > 0) {
    const primary = knowledge[0];
    let response = `**${primary.title}**\n\n`;
    
    // Take first 1000 chars of content
    const content = primary.content.slice(0, 1500);
    response += content;
    
    if (primary.source) {
      response += `\n\n*Source: ${primary.source}*`;
    }
    
    if (knowledge.length > 1) {
      response += `\n\n---\n**Related Topics:**\n`;
      knowledge.slice(1).forEach(k => {
        response += `• ${k.title}\n`;
      });
    }
    
    return response;
  }

  // Generic fallback
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("how many") && (lowerQuery.includes("staff") || lowerQuery.includes("security"))) {
    return `**Security Staffing Guidelines**

📊 **Recommended Ratios:**
- **Low risk events**: 1 security per 100 guests
- **Medium risk events**: 1 security per 75 guests  
- **High risk events**: 1 security per 50 guests
- **Nightclubs/Bars**: Minimum 2 door supervisors + 1 per 100 capacity

📋 **Factors that increase requirements:**
- Alcohol served (especially late night)
- Standing room/dance floor
- History of incidents
- VIP areas

Would you like me to calculate staffing for a specific event?`;
  }

  if (lowerQuery.includes("sia") || lowerQuery.includes("license") || lowerQuery.includes("licence")) {
    return `**SIA License Information**

🛡️ **License Types:**
- **Door Supervisor (DS)** - Licensed premises, nightclubs, bars
- **Security Guard (SG)** - Static guarding, patrols
- **CCTV Operator** - Public space surveillance
- **Close Protection (CP)** - Bodyguard work

📝 **Requirements:**
1. Be 18+ with right to work in UK
2. Complete approved training (4-6 days)
3. Pass the exam
4. Apply at sia.homeoffice.gov.uk
5. Fee: £190 | Validity: 3 years

Need specific license guidance?`;
  }

  const roleTips: Record<string, string> = {
    venue: `**Using Shield:**
- "How do I make a booking?"
- "How do I find and hire staff?"
- "How do I track who's checked in?"

**Security advice:**
- "How many security do I need for 500 guests?"
- "What are my premises licence requirements?"`,
    personnel: `**Using Shield:**
- "How do I find and accept shifts?"
- "How do I check in to a shift?"
- "How do I get paid and see my earnings?"
- "How do I get verified?"

**Career advice:**
- "How do I renew my SIA licence?"
- "How do I get more shifts?"`,
    agency: `**Using Shield:**
- "How do I find work for my staff?"
- "How do I manage my team?"

**Business advice:**
- "How do I win more contracts?"
- "What insurance does my agency need?"`,
  };

  return `**Hi, I'm Vera** 🛡️

I can help you **use the Shield app** and answer **security industry** questions.

${roleTips[context.role] || roleTips.venue}

What would you like to know?`;
}
