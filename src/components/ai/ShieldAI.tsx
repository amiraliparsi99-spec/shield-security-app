"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
}

const quickActionsByRole: Record<string, QuickAction[]> = {
  venue: [
    { label: "Make a booking", prompt: "How do I make a booking?", icon: "📅" },
    { label: "Find staff", prompt: "How do I find and hire staff?", icon: "🔍" },
    { label: "Track check-ins", prompt: "How do I track who has checked in?", icon: "📍" },
    { label: "Staff needed?", prompt: "How many security staff do I need for 500 guests?", icon: "👥" },
  ],
  personnel: [
    { label: "Find shifts", prompt: "How do I find and accept shifts?", icon: "🔍" },
    { label: "Check in", prompt: "How do I check in to a shift?", icon: "📍" },
    { label: "Get paid", prompt: "How do I get paid and see my earnings?", icon: "💰" },
    { label: "Get verified", prompt: "How do I get verified and upload my documents?", icon: "✅" },
  ],
  agency: [
    { label: "Find work", prompt: "How do I find work for my staff?", icon: "🔍" },
    { label: "Manage team", prompt: "How do I manage my team on Shield?", icon: "👥" },
    { label: "Win contracts", prompt: "How can I win more security contracts?", icon: "📈" },
    { label: "Compliance", prompt: "What insurance does my agency need?", icon: "📜" },
  ],
};

interface ShieldAIProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: "venue" | "personnel" | "agency";
  userName?: string;
}

/** Render inline **bold** segments as real bold text (no visible asterisks). */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t-${i}`}>{part}</span>;
  });
}

/**
 * Lightweight Markdown renderer for assistant messages. Handles the small
 * subset the model actually uses (headings, bold, bullet and numbered lists)
 * so users see clean, bold, professional text instead of raw ** and # symbols.
 */
function FormattedMessage({ content }: { content: string }) {
  const blocks = content.split("\n").map((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) return <div key={idx} className="h-1.5" />;

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      return (
        <p key={idx} className="mt-2 mb-0.5 text-[15px] font-bold text-white">
          {renderInline(heading[1], `h${idx}`)}
        </p>
      );
    }

    const bullet = line.match(/^[-•]\s+(.*)$/);
    if (bullet) {
      return (
        <div key={idx} className="flex gap-2">
          <span className="select-none text-zinc-500">•</span>
          <span className="flex-1">{renderInline(bullet[1], `u${idx}`)}</span>
        </div>
      );
    }

    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      return (
        <div key={idx} className="flex gap-2">
          <span className="select-none font-semibold text-zinc-300">{numbered[1]}.</span>
          <span className="flex-1">{renderInline(numbered[2], `n${idx}`)}</span>
        </div>
      );
    }

    return <p key={idx}>{renderInline(line, `p${idx}`)}</p>;
  });

  return <div className="space-y-0.5 text-sm leading-relaxed">{blocks}</div>;
}

export function ShieldAI({ isOpen, onClose, userRole, userName }: ShieldAIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial greeting based on user role
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = getGreeting();
      setMessages([{
        id: "greeting",
        role: "assistant",
        content: greeting,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, userRole, userName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const getGreeting = () => {
    const name = userName ? `, ${userName}` : "";
    const roleGreetings: Record<string, string> = {
      venue: `Hi${name}! 👋 I'm Vera, your security assistant.\n\nI can help you:\n• Find and book security staff\n• Predict staffing needs for events\n• Answer questions about the platform\n\nWhat can I help you with today?`,
      personnel: `Hi${name}! 👋 I'm Vera, your security assistant.\n\nI can help you:\n• Find the best-paying shifts in your area\n• Track your earnings and payments\n• Optimize your profile for more bookings\n\nWhat would you like to know?`,
      agency: `Hi${name}! 👋 I'm Vera, your security assistant.\n\nI can help you:\n• Manage staff scheduling\n• Forecast demand and revenue\n• Find backup staff with Instant Fill\n• Track compliance and documents\n\nHow can I assist you today?`,
    };
    return roleGreetings[userRole || "venue"] || roleGreetings.venue;
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          userRole,
          conversationHistory: messages.slice(-10), // Last 10 messages for context
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSend(action.prompt);
  };

  const clearChat = () => {
    setMessages([{
      id: "greeting",
      role: "assistant",
      content: getGreeting(),
      timestamp: new Date(),
    }]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Chat Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed bottom-4 right-4 z-50 flex h-[600px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl sm:bottom-6 sm:right-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-xl ring-1 ring-emerald-500/40">
                  <Image
                    src="/vera-avatar.png"
                    alt="Vera"
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Vera</h3>
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Your security assistant
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                  title="Clear chat"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-purple-500/20 text-white border border-purple-500/30"
                        : "bg-zinc-900 text-zinc-100 border border-white/10"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <FormattedMessage content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    )}
                    <p className={`mt-1 text-xs ${
                      message.role === "user" ? "text-white/60" : "text-zinc-500"
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-zinc-900 border border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-sm text-zinc-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="border-t border-white/10 bg-zinc-950 px-4 py-3">
                <p className="mb-2 text-xs font-medium text-zinc-500">Popular questions</p>
                <div className="flex flex-wrap gap-2">
                  {(quickActionsByRole[userRole || "venue"] || quickActionsByRole.venue).map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:border-white/20 hover:text-white"
                    >
                      <span>{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-white/10 bg-zinc-950 p-4">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about staffing, licensing, incidents..."
                  className="flex-1 rounded-xl border border-white/20 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-zinc-600">
                Responses help train our security-specific model
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Floating AI Button Component
export function ShieldAIButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label="Open Vera, your security assistant"
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/40 lg:bottom-6 lg:right-6"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
    >
      {/* Pulse effect (sits behind the avatar so it isn't clipped) */}
      <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-20" />

      <span className="relative block h-full w-full overflow-hidden rounded-full ring-2 ring-emerald-500/50">
        <Image
          src="/vera-avatar.png"
          alt="Vera"
          width={56}
          height={56}
          className="h-full w-full object-cover"
        />
      </span>
    </motion.button>
  );
}
