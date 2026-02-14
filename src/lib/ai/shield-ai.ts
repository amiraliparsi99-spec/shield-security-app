/**
 * Shield AI - Security Industry AI Assistant
 * The first AI-powered security operations platform
 */

import { createClient } from "@/lib/supabase/client";

// Security industry knowledge base context
export const SECURITY_SYSTEM_PROMPT = `You are Shield AI, the UK's leading AI assistant for the security industry. You are an expert consultant who helps venues, security agencies, and security professionals succeed in their roles.

## YOUR IDENTITY
- You are Shield AI, created by Shield - the modern security workforce platform
- You have deep expertise in UK security operations, regulations, and best practices
- You provide practical, actionable advice based on real industry knowledge
- You communicate professionally but warmly, like a knowledgeable colleague

## YOUR EXPERTISE

### For VENUES (Clubs, Bars, Events, Corporate, Retail):
- Security staffing ratios and deployment
- Licensing Act compliance and premises license conditions
- CCTV requirements and GDPR compliance
- Managing security teams effectively
- Cost optimization without compromising safety
- Incident management and documentation
- Emergency procedures and evacuation planning
- Working with police and licensing authorities
- Dealing with problem customers and ejections
- Challenge 25 and age verification

### For SECURITY AGENCIES:
- Starting and growing a security business
- SIA Approved Contractor Scheme (ACS)
- Staff recruitment, vetting, and retention
- Pricing strategies and winning contracts
- Scheduling and workforce management
- Compliance and documentation requirements
- Insurance requirements (EL, PL, PI)
- Agency Workers Regulations
- Payroll and invoicing best practices
- Client relationship management

### For SECURITY PERSONNEL:
- SIA licensing (DS, SG, CCTV, CP) requirements and renewal
- Career progression from guard to supervisor to manager
- Getting more shifts and building reputation
- Skills development and valuable qualifications
- Rights and working conditions
- De-escalation and conflict management techniques
- Legal powers (use of force, citizen's arrest, search)
- First aid and emergency response
- Professional conduct and appearance
- Building a successful security career

### Core Knowledge Areas:
1. **SIA Licensing** - All license types, requirements, costs, renewal processes
2. **Legal Compliance** - Licensing Act, PSIA 2001, GDPR, H&S, use of force law
3. **Operations** - Staffing ratios, deployment, incident management, emergencies
4. **Business** - Pricing, contracts, vetting, retention, growth strategies
5. **Career** - Progression paths, qualifications, rights, getting work

## HOW TO RESPOND

**Be Specific:**
- Give exact numbers (e.g., "1 security per 75-100 guests for medium-risk events")
- Reference actual regulations and requirements
- Provide step-by-step guidance when relevant

**Be Practical:**
- Focus on actionable advice they can implement
- Consider cost implications
- Prioritize safety and compliance
- Suggest Shield platform features when relevant

**Be Personalized:**
- Adjust advice based on their role (venue/agency/personnel)
- Reference their context when provided
- Anticipate follow-up questions

**Format Well:**
- Use bullet points for lists
- Use bold for key points
- Break up long responses into sections
- Include relevant examples

## IMPORTANT GUIDELINES
- Always prioritize safety and legal compliance
- Never advise anything that could compromise security or break laws
- Be honest if something is outside your knowledge
- Encourage professional training for complex topics
- Reference UK regulations and standards (this is a UK-focused platform)

You have access to the user's Shield platform data. Use their context (role, bookings, staff, incidents) to provide personalized advice.`;

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface UserContext {
  role: "venue" | "agency" | "personnel";
  name?: string;
  entityId?: string;
  // Stats
  totalBookings?: number;
  upcomingShifts?: number;
  totalStaff?: number;
  avgRating?: number;
  // Recent activity
  recentIncidents?: number;
  pendingApplications?: number;
  expiringLicenses?: number;
}

// Build context from user's data
export async function buildUserContext(
  userId: string,
  role: string
): Promise<UserContext> {
  const supabase = createClient();
  const context: UserContext = { role: role as UserContext["role"] };

  try {
    if (role === "venue") {
      // Get venue data
      const { data: venue } = await supabase
        .from("venues")
        .select("id, name")
        .eq("user_id", userId)
        .single();

      if (venue) {
        context.name = venue.name;
        context.entityId = venue.id;

        // Get stats
        const { count: bookingsCount } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", venue.id);

        const { count: upcomingCount } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", venue.id)
          .gte("shift_date", new Date().toISOString().split("T")[0])
          .in("status", ["pending", "confirmed"]);

        context.totalBookings = bookingsCount || 0;
        context.upcomingShifts = upcomingCount || 0;
      }
    } else if (role === "agency") {
      // Get agency data
      const { data: agency } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("user_id", userId)
        .single();

      if (agency) {
        context.name = agency.name;
        context.entityId = agency.id;

        // Get staff count
        const { count: staffCount } = await supabase
          .from("personnel")
          .select("*", { count: "exact", head: true });

        // Get pending applications
        const { count: applicationsCount } = await supabase
          .from("shift_applications")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        context.totalStaff = staffCount || 0;
        context.pendingApplications = applicationsCount || 0;
      }
    } else if (role === "personnel") {
      // Get personnel data
      const { data: personnel } = await supabase
        .from("personnel")
        .select("id, display_name, sia_expiry_date")
        .eq("user_id", userId)
        .single();

      if (personnel) {
        context.name = personnel.display_name;
        context.entityId = personnel.id;

        // Check for expiring license
        if (personnel.sia_expiry_date) {
          const expiryDate = new Date(personnel.sia_expiry_date);
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          if (expiryDate <= thirtyDaysFromNow) {
            context.expiringLicenses = 1;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error building user context:", error);
  }

  return context;
}

// Format context for the AI
export function formatContextForAI(context: UserContext): string {
  const parts: string[] = [];

  parts.push(`User Role: ${context.role}`);
  if (context.name) parts.push(`Organization: ${context.name}`);

  if (context.role === "venue") {
    parts.push(`Total Bookings: ${context.totalBookings || 0}`);
    parts.push(`Upcoming Shifts: ${context.upcomingShifts || 0}`);
  } else if (context.role === "agency") {
    parts.push(`Total Staff: ${context.totalStaff || 0}`);
    parts.push(`Pending Applications: ${context.pendingApplications || 0}`);
  } else if (context.role === "personnel") {
    if (context.expiringLicenses) {
      parts.push(`⚠️ SIA License expiring within 30 days`);
    }
  }

  return `\n\n[USER CONTEXT]\n${parts.join("\n")}`;
}

// Suggested prompts based on role
export const SUGGESTED_PROMPTS: Record<string, string[]> = {
  venue: [
    "How many security staff do I need for a 500-person event?",
    "What are my legal requirements for door supervisors under my premises license?",
    "How can I reduce security costs without compromising safety?",
    "What CCTV requirements do I need to comply with GDPR?",
    "Help me create an emergency evacuation procedure",
    "What's the best way to handle drunk or aggressive customers?",
    "What should be in my security briefing before events?",
    "How do I verify if a security officer's SIA license is valid?",
  ],
  agency: [
    "How can I improve my staff retention rates?",
    "What's involved in getting SIA Approved Contractor status?",
    "How do I handle last-minute shift cancellations?",
    "What should my staff vetting process include?",
    "How should I price my security services?",
    "What insurance do I need for my security agency?",
    "How can I win more security contracts?",
    "What are my obligations under Agency Workers Regulations?",
  ],
  personnel: [
    "How do I renew my SIA license before it expires?",
    "What's the best way to progress from guard to supervisor?",
    "How do I handle an aggressive person using de-escalation?",
    "What are my rights regarding breaks and working hours?",
    "How can I get more shifts on the Shield platform?",
    "What additional qualifications would boost my career?",
    "What are my legal powers for detaining someone?",
    "How much should I be earning as a door supervisor?",
  ],
};

// Quick action commands the AI can suggest
export const AI_ACTIONS = {
  CREATE_BOOKING: "create_booking",
  POST_SHIFT: "post_shift",
  VIEW_ANALYTICS: "view_analytics",
  CHECK_COMPLIANCE: "check_compliance",
  GENERATE_REPORT: "generate_report",
  FIND_STAFF: "find_staff",
} as const;

export type AIAction = (typeof AI_ACTIONS)[keyof typeof AI_ACTIONS];

// Parse AI response for action suggestions
export function parseActionsFromResponse(response: string): AIAction[] {
  const actions: AIAction[] = [];
  const lowerResponse = response.toLowerCase();

  if (lowerResponse.includes("create a booking") || lowerResponse.includes("book security")) {
    actions.push(AI_ACTIONS.CREATE_BOOKING);
  }
  if (lowerResponse.includes("post a shift") || lowerResponse.includes("advertise the position")) {
    actions.push(AI_ACTIONS.POST_SHIFT);
  }
  if (lowerResponse.includes("check your analytics") || lowerResponse.includes("view your dashboard")) {
    actions.push(AI_ACTIONS.VIEW_ANALYTICS);
  }
  if (lowerResponse.includes("compliance") || lowerResponse.includes("license check")) {
    actions.push(AI_ACTIONS.CHECK_COMPLIANCE);
  }

  return actions;
}
