"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderType: "agency" | "personnel";
  content: string;
  timestamp: string;
  read: boolean;
};

type Conversation = {
  id: string;
  participantName: string;
  participantType: "agency" | "personnel";
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar?: string;
};

const mockConversations: Conversation[] = [
  {
    id: "1",
    participantName: "Elite Security Services",
    participantType: "agency",
    lastMessage: "Confirmed! All 6 staff will arrive by 20:30 as requested.",
    lastMessageTime: "2026-01-30T10:30:00",
    unreadCount: 1,
  },
  {
    id: "2",
    participantName: "Marcus Johnson",
    participantType: "personnel",
    lastMessage: "Thanks for the feedback! Looking forward to next week.",
    lastMessageTime: "2026-01-29T18:45:00",
    unreadCount: 0,
  },
  {
    id: "3",
    participantName: "Guardian Security",
    participantType: "agency",
    lastMessage: "We can accommodate the extra 2 staff for Saturday.",
    lastMessageTime: "2026-01-28T14:20:00",
    unreadCount: 0,
  },
  {
    id: "4",
    participantName: "Premium Protection Ltd",
    participantType: "agency",
    lastMessage: "Quote attached for your VIP event next month.",
    lastMessageTime: "2026-01-25T09:15:00",
    unreadCount: 2,
  },
];

const mockMessages: Message[] = [
  {
    id: "m1",
    senderId: "1",
    senderName: "Elite Security Services",
    senderType: "agency",
    content: "Hi! Confirming receipt of your booking for Friday night.",
    timestamp: "2026-01-30T09:00:00",
    read: true,
  },
  {
    id: "m2",
    senderId: "venue",
    senderName: "You",
    senderType: "agency",
    content: "Great, thanks! Can the team arrive 30 minutes early for briefing?",
    timestamp: "2026-01-30T09:15:00",
    read: true,
  },
  {
    id: "m3",
    senderId: "1",
    senderName: "Elite Security Services",
    senderType: "agency",
    content: "Confirmed! All 6 staff will arrive by 20:30 as requested.",
    timestamp: "2026-01-30T10:30:00",
    read: false,
  },
];

export default function MessagesPage() {
  const [conversations] = useState<Conversation[]>(mockConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState("");

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    // In a real app, this would send via API
    alert(`Message sent: ${newMessage}`);
    setNewMessage("");
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-GB", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Messages</h1>
          <p className="text-sm text-zinc-400">
            {totalUnread > 0 ? `${totalUnread} unread messages` : "All caught up!"}
          </p>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden h-[calc(100%-5rem)] flex">
        {/* Conversations List */}
        <div className={`w-full md:w-80 border-r border-white/10 flex-shrink-0 ${selectedConversation ? "hidden md:block" : ""}`}>
          <div className="p-4 border-b border-white/10">
            <input
              type="text"
              placeholder="Search messages..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition text-sm"
            />
          </div>
          <div className="overflow-y-auto h-[calc(100%-4.5rem)]">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b border-white/5 cursor-pointer transition ${
                  selectedConversation?.id === conv.id
                    ? "bg-purple-500/10"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                    conv.participantType === "agency"
                      ? "bg-gradient-to-br from-purple-500 to-pink-500"
                      : "bg-gradient-to-br from-shield-500 to-cyan-500"
                  }`}>
                    {conv.participantName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white truncate">{conv.participantName}</p>
                      <span className="text-xs text-zinc-500 flex-shrink-0">{formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${!selectedConversation ? "hidden md:flex" : ""}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden text-zinc-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  selectedConversation.participantType === "agency"
                    ? "bg-gradient-to-br from-purple-500 to-pink-500"
                    : "bg-gradient-to-br from-shield-500 to-cyan-500"
                }`}>
                  {selectedConversation.participantName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-white">{selectedConversation.participantName}</p>
                  <p className="text-xs text-zinc-500 capitalize">{selectedConversation.participantType}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderId === "venue" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      msg.senderId === "venue"
                        ? "bg-purple-500 text-white rounded-br-md"
                        : "bg-white/10 text-white rounded-bl-md"
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${
                        msg.senderId === "venue" ? "text-purple-200" : "text-zinc-500"
                      }`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                  />
                  <motion.button
                    onClick={handleSendMessage}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl transition"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-zinc-400">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
