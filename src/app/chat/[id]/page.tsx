import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveUserDisplay } from "@/lib/chat";
import { ChatThread } from "@/components/chat/ChatThread";

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/chat/" + conversationId);

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, participant1_id, participant2_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) notFound();
  const me = user.id;
  if (me !== conv.participant1_id && me !== conv.participant2_id) notFound();

  const otherUserId = conv.participant1_id === me ? conv.participant2_id : conv.participant1_id;
  const other = await resolveUserDisplay(otherUserId);

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Link href="/chat" className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Messages
        </Link>
        
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-shield-500 to-shield-600 text-white font-semibold shadow-lg shadow-shield-500/20">
            {(other?.displayName ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-white">{other?.displayName ?? "Chat"}</h1>
            {other?.role && <p className="text-xs capitalize text-zinc-500">{other.role}</p>}
          </div>
        </div>

        <div className="mt-6 glass rounded-2xl p-4">
          <ChatThread
            conversationId={conversationId}
            messages={messages ?? []}
            currentUserId={me}
            otherDisplayName={other?.displayName ?? "User"}
          />
        </div>
      </div>
    </div>
  );
}
