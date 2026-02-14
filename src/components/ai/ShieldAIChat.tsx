"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUGGESTED_PROMPTS } from "@/lib/ai/shield-ai";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: { title: string; category: string }[];
  conversationId?: string;
  feedback?: "helpful" | "not_helpful" | null;
}

interface Props {
  userRole: "venue" | "agency" | "personnel";
  onAction?: (action: string) => void;
}

export function ShieldAIChat({ userRole, onAction }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hi! I'm **Shield AI**, your security operations assistant. 🛡️\n\nI have access to comprehensive knowledge about SIA licensing, staffing guidelines, incident management, and UK security regulations.\n\nWhat would you like to know?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          role: userRole,
          sessionId: sessionId,
        }),
      });

      const data = await response.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "I apologize, I couldn't process that. Please try again.",
        timestamp: new Date(),
        sources: data.sources,
        conversationId: data.conversationId,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm having trouble connecting. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, helpful: boolean) => {
    // Update local state
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, feedback: helpful ? "helpful" : "not_helpful" }
          : m
      )
    );

    // Send to API
    const message = messages.find((m) => m.id === messageId);
    if (message?.conversationId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch("/api/ai/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            conversationId: message.conversationId,
            helpful,
          }),
        });
      } catch (e) {
        console.error("Feedback error:", e);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const suggestedPrompts = SUGGESTED_PROMPTS[userRole] || SUGGESTED_PROMPTS.personnel;

  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      if (line.startsWith("# ")) {
        return (
          <h3 key={i} className="text-lg font-bold text-white mt-3 mb-2">
            <span dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
          </h3>
        );
      }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return (
          <li key={i} className="ml-4 text-dark-300">
            <span dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <li key={i} className="ml-4 text-dark-300 list-decimal">
            <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, "") }} />
          </li>
        );
      }
      if (!line.trim()) {
        return <br key={i} />;
      }
      return (
        <p key={i} className="text-dark-300">
          <span dangerouslySetInnerHTML={{ __html: line }} />
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-50 ${
          isOpen
            ? "bg-dark-700 rotate-45"
            : "bg-gradient-to-r from-accent to-emerald-500 hover:scale-110"
        }`}
      >
        {isOpen ? (
          <span className="text-2xl text-white">+</span>
        ) : (
          <span className="text-2xl">🛡️</span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[420px] h-[550px] bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-accent/20 to-emerald-500/20 border-b border-dark-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xl">🛡️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">Shield AI</h3>
                <p className="text-xs text-dark-400">Security Operations Assistant • RAG Enabled</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="AI Active" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-accent text-white rounded-br-md"
                        : "bg-dark-700 rounded-bl-md"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-sm space-y-1">{renderContent(message.content)}</div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                </div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="flex gap-1 mt-1 ml-1 flex-wrap">
                    {message.sources.map((source, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 bg-dark-700 text-dark-400 rounded-full"
                      >
                        📚 {source.title.slice(0, 30)}...
                      </span>
                    ))}
                  </div>
                )}

                {/* Feedback buttons */}
                {message.role === "assistant" && message.id !== "welcome" && (
                  <div className="flex gap-2 mt-2 ml-1">
                    {message.feedback === null || message.feedback === undefined ? (
                      <>
                        <button
                          onClick={() => handleFeedback(message.id, true)}
                          className="text-[10px] px-2 py-0.5 bg-dark-700 hover:bg-dark-600 text-dark-400 rounded-full transition-colors"
                        >
                          👍 Helpful
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, false)}
                          className="text-[10px] px-2 py-0.5 bg-dark-700 hover:bg-dark-600 text-dark-400 rounded-full transition-colors"
                        >
                          👎 Not helpful
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                        ✓ Thanks for feedback!
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-dark-700 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="text-xs text-dark-400 mr-2">Searching knowledge base</span>
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-dark-500 mb-2">Popular questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-full transition-colors"
                  >
                    {prompt.length > 35 ? prompt.slice(0, 35) + "..." : prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-dark-600">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about staffing, licensing, incidents..."
                disabled={loading}
                style={{ color: '#ffffff', backgroundColor: '#1f2937' }}
                className="flex-1 px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-sm placeholder:text-dark-500 focus:border-accent focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="px-4 py-2.5 bg-accent hover:bg-accent-dark disabled:bg-accent/50 text-white rounded-xl transition-colors font-medium"
              >
                Send
              </button>
            </div>
            <p className="text-[10px] text-dark-500 mt-2 text-center">
              Powered by Shield AI • Responses help train our security-specific model
            </p>
          </div>
        </div>
      )}
    </>
  );
}
