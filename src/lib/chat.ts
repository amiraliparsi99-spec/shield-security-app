"use server";

import { createClient } from "@/lib/supabase/server";

export type ResolveUser = { displayName: string; role: string | null };

/** Resolve auth user id to display name and role using profiles → personnel / agencies / venues. */
export async function resolveUserDisplay(userId: string): Promise<ResolveUser | null> {
  const supabase = await createClient();

  // Profile: support both profiles.user_id and profiles.id (0001 vs 0003-style)
  let role: string | null = null;
  const byUserId = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (byUserId.data) role = byUserId.data.role;
  else {
    const byId = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (byId.data) role = (byId.data as { role?: string | null }).role ?? null;
  }

  if (role === "personnel") {
    const { data } = await supabase.from("personnel").select("display_name").eq("user_id", userId).limit(1).maybeSingle();
    return { displayName: data?.display_name ?? "Security", role };
  }
  if (role === "agency") {
    const { data } = await supabase.from("agencies").select("name").eq("owner_id", userId).limit(1).maybeSingle();
    return { displayName: data?.name ?? "Agency", role };
  }
  if (role === "venue") {
    const { data } = await supabase.from("venues").select("name").eq("owner_id", userId).limit(1).maybeSingle();
    return { displayName: data?.name ?? "Venue", role };
  }

  return { displayName: "User", role };
}

/** Get or create a 1:1 conversation. Returns conversation id or { error }. */
export async function getOrCreateConversation(otherUserId: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const me = user.id;
  if (me === otherUserId) return { error: "Cannot message yourself" };

  const [u1, u2] = [me, otherUserId].sort();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id_1", u1)
    .eq("user_id_2", u2)
    .maybeSingle();

  if (existing?.id) return { id: existing.id };

  const { data: inserted, error } = await supabase
    .from("conversations")
    .insert({ user_id_1: u1, user_id_2: u2 })
    .select("id")
    .single();

  if (error) {
    // FK or RLS: e.g. otherUserId not in auth.users
    return { error: "Could not start conversation. This user may not have an account yet." };
  }
  return { id: inserted?.id };
}

/** Send a message. Returns { error } on failure. */
export async function sendMessage(conversationId: string, content: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const text = (content || "").trim();
  if (!text) return { error: "Message is empty" };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: text,
  });

  if (error) return { error: error.message };
  return {};
}
