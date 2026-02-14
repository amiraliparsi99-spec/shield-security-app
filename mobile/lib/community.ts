import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MOCK_COMMUNITY_POSTS,
  MOCK_COMMUNITY_PEOPLE,
  type CommunityPost,
  type CommunityPerson,
} from "../data/community";
import { resolveUserDisplay } from "./chat";

/** Fetch community feed. Uses mock when community_posts doesn't exist or is empty. */
export async function getCommunityFeed(
  supabase: SupabaseClient | null
): Promise<CommunityPost[]> {
  if (!supabase) return MOCK_COMMUNITY_POSTS;
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, author_id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data?.length) return MOCK_COMMUNITY_POSTS;
  const posts: CommunityPost[] = [];
  for (const row of data as { id: string; author_id: string; content: string; created_at: string }[]) {
    const resolved = await resolveUserDisplay(supabase, row.author_id);
    posts.push({
      id: row.id,
      author_id: row.author_id,
      author_name: resolved?.displayName ?? "User",
      author_role: resolved?.role ?? "User",
      content: row.content,
      created_at: row.created_at,
    });
  }
  return posts;
}

/** Fetch people to connect with. Uses mock when personnel lacks user_id or is empty. */
export async function getCommunityPeople(
  supabase: SupabaseClient | null
): Promise<CommunityPerson[]> {
  if (!supabase) return MOCK_COMMUNITY_PEOPLE;
  const { data: personnel, error } = await supabase
    .from("personnel")
    .select("id, user_id, display_name, experience")
    .limit(50);
  if (error || !personnel?.length) return MOCK_COMMUNITY_PEOPLE;
  const out = personnel
    .map((p) => ({
      id: p.id,
      user_id: (p as { user_id?: string }).user_id ?? "",
      display_name: p.display_name ?? "Security",
      role: "Security",
      title: p.experience ?? "Security professional",
      location: undefined as string | undefined,
    }))
    .filter((p) => p.user_id);
  return out.length ? out : MOCK_COMMUNITY_PEOPLE;
}

/** Create a post. No-op when community_posts doesn't exist; otherwise inserts. */
export async function createCommunityPost(
  supabase: SupabaseClient | null,
  content: string
): Promise<{ id?: string; error?: string }> {
  if (!supabase) return { error: "Not connected" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const text = (content || "").trim();
  if (!text) return { error: "Post is empty" };
  const { data, error } = await supabase
    .from("community_posts")
    .insert({ author_id: user.id, content: text })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data?.id };
}

/** Connect with another user. Stores (min, max) to match unique(user_id, connected_user_id). */
export async function connectWithUser(
  supabase: SupabaseClient | null,
  otherUserId: string
): Promise<{ error?: string }> {
  if (!supabase) return { error: "Not connected" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (user.id === otherUserId) return { error: "Cannot connect with yourself" };
  const [u1, u2] = [user.id, otherUserId].sort();
  const { error } = await supabase.from("connections").insert({
    user_id: u1,
    connected_user_id: u2,
  });
  if (error) {
    if (error.code === "23505") return {}; // already connected
    return { error: error.message };
  }
  return {};
}
