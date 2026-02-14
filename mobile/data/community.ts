/**
 * Mock data for Community (Feed + People).
 * In production, replace with Supabase: community_posts, connections, and personnel (for user_id).
 */

export interface CommunityPost {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
}

export interface CommunityPerson {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  title: string;
  location?: string;
}

export const MOCK_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: "cp1",
    author_id: "u-mock-1",
    author_name: "Marcus Webb",
    author_role: "Security",
    content: "Just finished a great run of weekend shifts at The Nightingale Club. If you're new to door work, my tip: stay calm, be clear with patrons, and always brief with the team before doors open. The best jobs come when venues know they can rely on you.",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "cp2",
    author_id: "u-mock-2",
    author_name: "Samira Hussein",
    author_role: "Security",
    content: "6 years in and I've worked clubs, retail, and now moving into event security. The SIA and First Aid certs opened so many doors. Anyone thinking about the switch — do it. This industry needs more good people.",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "cp3",
    author_id: "u-mock-3",
    author_name: "Metro Door Sec",
    author_role: "Agency",
    content: "We're growing our Birmingham pool. If you're SIA DS licensed, reliable, and want regular weekend work across clubs and bars, get in touch. We look after our team and pay on time.",
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "cp4",
    author_id: "u-mock-4",
    author_name: "Jordan Reid",
    author_role: "Security",
    content: "First stadium shift at the arena last week — total buzz. Big crowds are a different game to pub doors. If you get the chance, take it. The right training and team make all the difference.",
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

/** People to connect with: user_id is required for Message (chat). Mock uses fake UUIDs. */
export const MOCK_COMMUNITY_PEOPLE: CommunityPerson[] = [
  { id: "p1", user_id: "u-mock-1", display_name: "Marcus Webb", role: "Security", title: "Door supervisor · 8 years", location: "Birmingham" },
  { id: "p2", user_id: "u-mock-2", display_name: "Jordan Reid", role: "Security", title: "Door supervisor · 4 years", location: "Digbeth" },
  { id: "p3", user_id: "u-mock-3", display_name: "Samira Hussein", role: "Security", title: "SIA, First Aid, CCTV · 6 years", location: "Solihull" },
  { id: "p4", user_id: "u-mock-4", display_name: "Danny Cole", role: "Security", title: "Door supervisor · 3 years", location: "Edgbaston" },
  { id: "p5", user_id: "u-mock-5", display_name: "Alex Turner", role: "Security", title: "Event & door · 5 years", location: "Birmingham" },
  { id: "a1", user_id: "u-mock-a1", display_name: "Metro Door Sec", role: "Agency", title: "Door supervision, Events", location: "Birmingham" },
  { id: "a2", user_id: "u-mock-a2", display_name: "Apex Event Security", role: "Agency", title: "Events, Festival, Stadium", location: "Digbeth" },
];
