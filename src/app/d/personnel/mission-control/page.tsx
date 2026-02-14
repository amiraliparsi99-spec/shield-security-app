"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase } from "@/hooks/useSupabase";
import {
  getUserGroupChats,
  getGroupChat,
  getGroupChatMessages,
  sendGroupMessage,
  sendCheckInMessage,
  markMessagesAsRead,
  subscribeToGroupChat,
  type GroupChat,
  type GroupChatMember,
  type GroupChatMessage,
} from "@/lib/db/mission-control";
import { CallButton } from "@/components/calling/CallButton";

export default function PersonnelMissionControlPage() {
  const supabase = useSupabase();
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [activeChat, setActiveChat] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<GroupChatMember[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, [supabase]);

  useEffect(() => {
    const loadChats = async () => {
      setLoading(true);
      try {
        const data = await getUserGroupChats(supabase);
        setChats(data as GroupChat[]);
        if (data.length > 0 && !activeChat) {
          selectChat(data[0] as GroupChat);
        }
      } catch (e) {
        console.error("Error loading chats:", e);
      } finally {
        setLoading(false);
      }
    };
    loadChats();
  }, [supabase]);

  useEffect(() => {
    if (!activeChat) return;
    const unsubscribe = subscribeToGroupChat(
      supabase,
      activeChat.id,
      (newMsg) => {
        setMessages((prev) => [...prev, newMsg]);
        markMessagesAsRead(supabase, activeChat.id);
      }
    );
    return () => unsubscribe();
  }, [activeChat, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectChat = async (chat: GroupChat) => {
    setActiveChat(chat);
    const [chatData, messagesData] = await Promise.all([
      getGroupChat(supabase, chat.id),
      getGroupChatMessages(supabase, chat.id),
    ]);
    setMembers(chatData.members);
    setMessages(messagesData);
    markMessagesAsRead(supabase, chat.id);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChat || sending) return;
    setSending(true);
    const { success } = await sendGroupMessage(supabase, activeChat.id, newMessage.trim());
    if (success) setNewMessage("");
    setSending(false);
  };

  const handleQuickAction = async (action: string) => {
    if (!activeChat) return;
    setSending(true);
    
    const actions: Record<string, () => Promise<any>> = {
      arriving: () => sendCheckInMessage(supabase, activeChat.id, "arriving"),
      on_site: () => sendCheckInMessage(supabase, activeChat.id, "on_site"),
      position: () => sendCheckInMessage(supabase, activeChat.id, "position"),
      break: () => sendCheckInMessage(supabase, activeChat.id, "break"),
      leaving: () => sendCheckInMessage(supabase, activeChat.id, "leaving"),
    };
    
    if (actions[action]) await actions[action]();
    setShowQuickActions(false);
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const getMemberName = (senderId: string) => {
    return members.find(m => m.user_id === senderId)?.display_name || "Unknown";
  };

  const getMemberRole = (senderId: string) => {
    return members.find(m => m.user_id === senderId)?.role || "member";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-black">
      {/* Chat List */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-zinc-950">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            🎯 Mission Control
          </h1>
          <p className="text-sm text-zinc-400">Your active event teams</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => selectChat(chat)}
                className={`w-full p-4 text-left border-b border-white/5 transition ${
                  activeChat?.id === chat.id ? "bg-shield-500/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 flex items-center justify-center">
                    🛡️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{chat.name}</p>
                    <p className="text-xs text-zinc-500">
                      {chat.event_date && formatDate(chat.event_date)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                🎯
              </div>
              <h3 className="text-white font-medium mb-2">No Active Missions</h3>
              <p className="text-sm text-zinc-500">
                When you&apos;re assigned to a booking, Mission Control will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeChat ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{activeChat.name}</h2>
                <p className="text-sm text-zinc-400">
                  {members.length} team members{activeChat.event_date ? ` • ${formatDate(activeChat.event_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Call buttons for other members */}
                {members
                  .filter(m => m.user_id !== userId)
                  .slice(0, 4)
                  .map((member) => (
                    <div key={member.id} className="flex items-center gap-1.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 border-zinc-950 ${
                          member.role === "owner"
                            ? "bg-purple-500 text-white"
                            : "bg-zinc-700 text-zinc-300"
                        }`}
                        title={member.display_name || "Member"}
                      >
                        {(member.display_name || "?")[0].toUpperCase()}
                      </div>
                      <CallButton
                        userId={member.user_id}
                        name={member.display_name || "Team Member"}
                        role={member.role === "owner" ? "venue" : "personnel"}
                        bookingId={activeChat.booking_id || undefined}
                        variant="icon"
                        className="w-8 h-8"
                      />
                    </div>
                  ))}
                {members.filter(m => m.user_id !== userId).length > 4 && (
                  <span className="text-xs text-zinc-500">
                    +{members.filter(m => m.user_id !== userId).length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === userId;
              const isSystem = msg.message_type === "system";
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    isSystem
                      ? "mx-auto bg-zinc-800/50 text-zinc-400 text-center text-xs"
                      : isOwn
                      ? "ml-auto bg-shield-500/20 border border-shield-500/30 text-white"
                      : "bg-zinc-900 border border-white/10 text-white"
                  }`}
                >
                  {!isSystem && !isOwn && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-shield-400">
                        {getMemberName(msg.sender_id)}
                      </span>
                      {getMemberRole(msg.sender_id) === "owner" && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                          Venue
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-sm">{msg.content}</p>
                  {!isSystem && (
                    <p className="text-xs text-zinc-500 mt-1">{formatTime(msg.created_at)}</p>
                  )}
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Status Updates */}
          <AnimatePresence>
            {showQuickActions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/10 bg-zinc-950 overflow-hidden"
              >
                <div className="p-3 grid grid-cols-3 gap-2">
                  {[
                    { id: "arriving", icon: "🚗", label: "On my way" },
                    { id: "on_site", icon: "✅", label: "Arrived" },
                    { id: "position", icon: "📍", label: "In position" },
                    { id: "break", icon: "☕", label: "On break" },
                    { id: "leaving", icon: "👋", label: "Leaving" },
                  ].map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition text-sm text-white"
                    >
                      <span>{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="p-4 border-t border-white/10 bg-zinc-950">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className={`p-3 rounded-xl transition ${
                  showQuickActions ? "bg-shield-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-shield-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-3 rounded-xl bg-shield-500 text-white hover:bg-shield-600 disabled:opacity-50 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-4">
              🎯
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Select a Mission</h2>
            <p className="text-zinc-500">Choose an event from the sidebar</p>
          </div>
        </div>
      )}
    </div>
  );
}
