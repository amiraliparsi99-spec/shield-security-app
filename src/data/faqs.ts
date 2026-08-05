/**
 * Shield HQ FAQs — shared between the public /faqs marketing page and the
 * in-app Help Centre (/help). Keep questions short and answers practical.
 */

export type FAQCategory =
  | "general"
  | "venues"
  | "guards"
  | "payments"
  | "using-the-app";

export type FAQ = {
  category: FAQCategory;
  question: string;
  answer: string;
  /** Which logged-in roles this FAQ is relevant to. Undefined = everyone. */
  roles?: ("venue" | "personnel" | "agency")[];
};

export const FAQS: FAQ[] = [
  // General
  { category: "general", question: "What is Shield HQ?", answer: "Shield HQ is a platform that connects venues (bars, clubs, event spaces, and more) directly with SIA-licensed security professionals. We cut out the middleman so venues get reliable staff fast, and guards earn more money." },
  { category: "general", question: "Where is Shield HQ available?", answer: "We're currently launching in Birmingham, UK — one of the busiest nightlife cities in the country. We're expanding to other UK cities soon. Sign up now to be first in line when we reach your area." },
  { category: "general", question: "Is Shield HQ free to use?", answer: "For venues, yes — completely free. There are no subscription fees, no sign-up costs, and no per-booking charges for venues. Security guards pay a small 10% fee from their earnings per shift, which is significantly less than the 30-40% traditional agencies take." },
  { category: "general", question: "How is Shield HQ different from a security agency?", answer: "Traditional agencies take 30-40% of what venues pay, and guards wait weeks to get paid. Shield HQ connects venues and guards directly with just a 10% fee from the guard's earnings. Venues pay the same rate — guards just keep more of it." },
  { category: "general", question: "Do I need to download an app?", answer: "The mobile app (available on iOS and Android) is the best way to use Shield HQ if you're a security guard — you get instant shift notifications, GPS check-in, and can manage everything on the go. Venues can use the web dashboard or the app." },

  // Venues
  { category: "venues", question: "How quickly can I find security staff?", answer: "Most shifts get responses within minutes. When you post a shift, Shield HQ instantly notifies all matching, available guards in your area. For last-minute requests, our Uber-style instant matching means you can fill shifts same-day.", roles: ["venue"] },
  { category: "venues", question: "Are all guards on Shield HQ SIA licensed?", answer: "Yes. Every security professional on Shield HQ must verify their SIA licence before they can accept any shifts. We check licence validity and type (Door Supervisor, Security Guard, etc.) during signup.", roles: ["venue", "agency"] },
  { category: "venues", question: "Can I book the same guards again?", answer: "Absolutely. You can save preferred staff, view their past performance at your venue, and request them directly for future shifts. Building relationships with reliable guards is what Shield HQ is all about.", roles: ["venue"] },
  { category: "venues", question: "What if a guard doesn't show up?", answer: "Shield HQ has GPS-verified check-in so you know exactly when staff arrive. If a guard cancels or doesn't show, we immediately notify available backup staff in your area. Your ratings and reviews help ensure reliability.", roles: ["venue"] },
  { category: "venues", question: "How do I pay for shifts?", answer: "As a venue, you pay the agreed hourly rate for the guard. The 10% platform fee comes from the guard's earnings — you don't pay any extra. All payments are handled securely through Stripe.", roles: ["venue"] },

  // Guards
  { category: "guards", question: "What SIA licence do I need?", answer: "You need a valid SIA Door Supervisor or Security Guard licence. During signup, you'll upload your licence details and we verify them. Having additional qualifications (First Aid, CCTV, etc.) makes your profile more attractive to venues.", roles: ["personnel", "agency"] },
  { category: "guards", question: "How much can I earn on Shield HQ?", answer: "You set your own hourly rate. A typical Door Supervisor in Birmingham earns £14-18/hr. With Shield HQ, you keep 90% of what the venue pays — compared to just 60-70% through traditional agencies. That's up to £672 more per month.", roles: ["personnel"] },
  { category: "guards", question: "How do I get paid?", answer: "After completing a shift, your earnings (minus the 10% platform fee) are processed and sent to your bank account. You can track all your earnings, pending payments, and completed shifts in the app.", roles: ["personnel"] },
  { category: "guards", question: "Can I choose which shifts I work?", answer: "Yes — you're in full control. Set your availability for when you're free, browse available shifts on the map, and accept only the ones that work for you. There's no minimum commitment or exclusivity.", roles: ["personnel"] },
  { category: "guards", question: "What happens if I need to cancel a shift?", answer: "We understand things come up. You can cancel a shift through the app, but please give as much notice as possible. Repeated last-minute cancellations may affect your reliability rating, which venues can see.", roles: ["personnel"] },

  // Payments
  { category: "payments", question: "What does the 10% fee cover?", answer: "The 10% guard fee covers the platform: instant matching, SIA verification, secure payments, GPS check-in, ratings and reviews, notifications, and ongoing support. It's taken from the guard's earnings — venues don't pay any platform fees." },
  { category: "payments", question: "Are there any hidden fees?", answer: "No. For venues: £0 — always. For guards: 10% from your shift earnings. That's it. No sign-up fees, no monthly subscriptions, no cancellation charges." },
  { category: "payments", question: "How are payments processed?", answer: "All payments go through Stripe, one of the world's most trusted payment processors. Your financial details are encrypted and never stored on our servers." },
  { category: "payments", question: "When do guards get paid?", answer: "Payments are processed after the venue confirms the shift is complete. We're building instant payouts so you can access your earnings even faster — stay tuned." },

  // Using the app (in-app Help Centre only)
  { category: "using-the-app", question: "How do I book security for an event?", answer: "From your dashboard, click \"Book Security\" (top-right or in Quick Actions). Pick the date, times, number of guards and role required, then post it. Matching guards are notified instantly and you'll see responses come in on the booking page.", roles: ["venue"] },
  { category: "using-the-app", question: "What is Live Check-In?", answer: "Live Check-In (under Live Operations) shows you in real time who has arrived on site, verified by GPS. Each guard checks in from the mobile app when they arrive, so you never have to wonder whether your door is covered.", roles: ["venue"] },
  { category: "using-the-app", question: "What is Mission Control?", answer: "Mission Control is your live team chat for each event — message guards individually or as a group, share instructions, and keep everything about the night in one thread.", roles: ["venue", "agency", "personnel"] },
  { category: "using-the-app", question: "What does \"Needs Attention\" show me?", answer: "It's your alert inbox: late arrivals, unfilled shifts, pending confirmations and anything else that needs a decision from you. If something needs action before doors open, it'll be there.", roles: ["venue", "agency"] },
  { category: "using-the-app", question: "How do incident reports work?", answer: "Guards can file incident reports from the app during or after a shift. You'll find them under Live Operations → Incidents, with the time, location, severity and a written account — useful for licensing reviews and disputes.", roles: ["venue"] },
  { category: "using-the-app", question: "How do I save guards I want to work with again?", answer: "After a shift, rate the guard or open their profile and add them to Preferred Staff. Preferred guards are prioritised when you post future shifts.", roles: ["venue"] },
  { category: "using-the-app", question: "How do I set my availability?", answer: "In the mobile app, open Availability and set the days and hours you're free to work. You'll only be notified about shifts that match.", roles: ["personnel"] },
  { category: "using-the-app", question: "How do I replay the app tour?", answer: "Open the Help menu in the top bar and choose \"Replay app tour\", or find the same option in Settings. The guided tour will start again from your dashboard.", roles: ["venue", "personnel", "agency"] },
];

export const FAQ_CATEGORIES: { id: FAQCategory; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "💡" },
  { id: "venues", label: "For Venues", icon: "🏢" },
  { id: "guards", label: "For Guards", icon: "🛡️" },
  { id: "payments", label: "Payments & Fees", icon: "💷" },
  { id: "using-the-app", label: "Using the App", icon: "📱" },
];

/** Categories shown on the public marketing FAQ page. */
export const PUBLIC_FAQ_CATEGORIES = FAQ_CATEGORIES.filter(
  (c) => c.id !== "using-the-app"
);

/** FAQs relevant to a logged-in role, for the in-app Help Centre. */
export function faqsForRole(role: "venue" | "personnel" | "agency"): FAQ[] {
  return FAQS.filter((f) => !f.roles || f.roles.includes(role));
}
