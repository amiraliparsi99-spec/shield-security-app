/**
 * Shield Weekly — editorial posts (curated). Keep in sync with `mobile/data/shield-blog.ts`.
 */

export type ShieldBlogPost = {
  slug: string;
  title: string;
  publishedAt: string;
  excerpt: string;
  content: string;
  tags?: string[];
};

export const SHIELD_BLOG_POSTS: ShieldBlogPost[] = [
  {
    slug: "sia-door-supervision-2026",
    title: "SIA and door supervision: what to expect in 2026",
    publishedAt: "2026-04-07T09:00:00.000Z",
    excerpt:
      "Renewals, training expectations, and how venues are briefing teams before doors open.",
    tags: ["SIA", "Door supervision", "Compliance"],
    content: `The security sector in the UK continues to tighten how licence holders stay current—not only on paperwork, but on practical judgement at the door.

Venues are increasingly asking for short, documented briefings before each shift: capacity plans, vulnerable patron protocols, and clear escalation paths to management. If you are working busy nights, treat the briefing as part of the job, not an add-on.

For door supervisors, the through-line is consistency: the same professional standard on a quiet Tuesday as on a packed Saturday. That consistency is what builds trust with licensing, with venues, and with the public.

Shield’s stance is simple: verified credentials, transparent shifts, and tools that keep teams aligned when plans change mid-event.`,
  },
  {
    slug: "night-time-economy-staffing",
    title: "Night-time economy staffing: fewer gaps, clearer handovers",
    publishedAt: "2026-03-31T09:00:00.000Z",
    excerpt:
      "Why short handovers and roster visibility are becoming non-negotiable for late-night venues.",
    tags: ["Night-time economy", "Operations"],
    content: `Late-night venues are under pressure to show proportionate security without burning out teams. The operators doing this well are investing in two things: visibility of who is on site, and disciplined handovers between agencies and in-house staff.

A five-minute overlap sounds small, but it prevents the “unknown unknowns” that cause incidents to escalate—who has the radio, where first aid is staged, and which entry is temporarily exit-only.

Shield is built around that operational clarity: when shifts are confirmed and teams can coordinate in one place, venues spend less time chasing updates and more time running a safe night.`,
  },
  {
    slug: "events-season-security",
    title: "Events season: scaling security without losing standards",
    publishedAt: "2026-03-24T09:00:00.000Z",
    excerpt:
      "From festivals to retail pop-ups—how teams are balancing surge demand with duty of care.",
    tags: ["Events", "Crowds", "Risk"],
    content: `Large crowds reward calm leadership. The best event security leads are training teams to read density, noise, and flow—not just respond after something goes wrong.

We are seeing more venues adopt layered staffing: outer perimeter awareness, inner crowd management, and dedicated comms for medical or welfare escalations. It is not about more bodies for the sake of it; it is about roles that are legible and rehearsed.

Shield’s marketplace aims to match that reality: clear roles, fair rates, and shifts that do not leave guards guessing what “good” looks like when the gates open.`,
  },
];

export function getShieldBlogPosts(): ShieldBlogPost[] {
  return [...SHIELD_BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getShieldBlogPost(slug: string): ShieldBlogPost | undefined {
  return SHIELD_BLOG_POSTS.find((p) => p.slug === slug);
}

export function getLatestShieldBlogPost(): ShieldBlogPost | undefined {
  const list = getShieldBlogPosts();
  return list[0];
}
