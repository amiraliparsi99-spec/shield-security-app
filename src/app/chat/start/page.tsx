import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateConversation } from "@/lib/chat";

export default async function ChatStartPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const { with: otherUserId } = await searchParams;
  if (!otherUserId) {
    redirect("/chat");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/chat/start?with=" + encodeURIComponent(otherUserId)));

  const result = await getOrCreateConversation(otherUserId);
  if (result.error) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-zinc-400">{result.error}</p>
        <Link href="/chat" className="mt-4 inline-block text-shield-400 hover:underline">← Back to messages</Link>
      </div>
    );
  }
  redirect("/chat/" + result.id);
}
