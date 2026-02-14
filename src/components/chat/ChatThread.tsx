"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtimeMessages, useMarkMessagesRead } from "@/hooks/useChat";

type Msg = { id: string; sender_id: string; content: string; created_at: string };

export function ChatThread({
  conversationId,
  messages: initialMessages,
  currentUserId,
  otherDisplayName,
}: {
  conversationId: string;
  messages: Msg[];
  currentUserId: string;
  otherDisplayName: string;
}) {
  const { messages, sendMessage } = useRealtimeMessages(conversationId, initialMessages);
  const { markRead } = useMarkMessagesRead();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    markRead(conversationId);
  }, [conversationId, markRead, messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const result = await sendMessage(text);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setContent("");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[400px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-t-xl border border-b-0 border-white/10 bg-white/[0.02] p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    isMe ? "bg-shield-500/30 text-white" : "bg-white/10 text-zinc-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                  <p className={`mt-1 text-xs ${isMe ? "text-shield-200/80" : "text-zinc-500"}`}>
                    {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="rounded-b-xl border border-white/10 bg-ink-950/80 p-3">
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={`Message ${otherDisplayName}…`}
            rows={1}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-shield-500/50 focus:outline-none focus:ring-1 focus:ring-shield-500/30"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="shrink-0 rounded-xl bg-shield-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-shield-600 disabled:opacity-50 disabled:hover:bg-shield-500"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
