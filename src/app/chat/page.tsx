import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveUserDisplay } from "@/lib/chat";

export default async function ChatListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/chat");

  const me = user.id;

  const { data: convos } = await supabase
    .from("conversations")
    .select("id, user_id_1, user_id_2, created_at")
    .or(`user_id_1.eq.${me},user_id_2.eq.${me}`)
    .order("created_at", { ascending: false });

  // Load last message per conversation
  const list: { id: string; otherUserId: string; lastAt: string; lastContent: string | null }[] = [];

  if (convos?.length) {
    for (const c of convos) {
      const other = c.user_id_1 === me ? c.user_id_2 : c.user_id_1;
      const { data: last } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      list.push({
        id: c.id,
        otherUserId: other,
        lastAt: last?.created_at ?? c.created_at,
        lastContent: last?.content ?? null,
      });
    }
  }

  // Resolve display names for others
  const resolved = await Promise.all(
    list.map(async (x) => ({
      ...x,
      display: await resolveUserDisplay(x.otherUserId),
    }))
  );

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-white">Messages</h1>
        <p className="mt-1 text-zinc-500">Your conversations with venues, agencies, and security.</p>

        {resolved.length === 0 ? (
          <div className="mt-10 glass rounded-2xl p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="mt-4 text-zinc-400">No conversations yet.</p>
            <p className="mt-1 text-sm text-zinc-500">Use <strong className="text-zinc-400">Message</strong> on a personnel, agency, or venue profile to start.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {resolved.map((r) => (
              <li key={r.id}>
                <Link
                  href={"/chat/" + r.id}
                  className="group flex items-center gap-4 glass rounded-xl p-4 transition-all hover:bg-white/[0.06] hover:shadow-glow-sm"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-shield-500 to-shield-600 text-white font-semibold shadow-lg shadow-shield-500/20">
                    {(r.display?.displayName ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white group-hover:text-shield-400 transition-colors">
                      {r.display?.displayName ?? "User"}
                    </p>
                    {r.display?.role && (
                      <p className="text-xs text-zinc-500 capitalize">{r.display.role}</p>
                    )}
                    {r.lastContent && (
                      <p className="mt-0.5 truncate text-sm text-zinc-400">{r.lastContent}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {new Date(r.lastAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
