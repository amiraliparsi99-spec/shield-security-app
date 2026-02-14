"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { CallButton } from "@/components/calling/CallButton";

interface Contact {
  id: string;
  user_id: string;
  name: string;
  type: "venue" | "agency";
  city?: string;
}

interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}

export default function MessagesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Subscribe to new messages + polling fallback
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev;
            }
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    // Polling fallback - check for new messages every 3 seconds
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages((prev) => {
          if (data.length !== prev.length) {
            return data;
          }
          return prev;
        });
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [conversation]);

  const loadContacts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError("Please sign in to view messages");
        setIsLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // Get personnel record - may not exist for new users
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      // If no personnel record, user hasn't completed profile setup
      if (!personnel) {
        // Still allow viewing existing conversations
        await loadExistingConversations(user.id);
        setIsLoading(false);
        return;
      }

      // Get agencies the guard works for
      const { data: agencyStaff } = await supabase
        .from("agency_staff")
        .select(`
          agency_id,
          agencies:agencies(id, user_id, name, city)
        `)
        .eq("personnel_id", personnel.id)
        .eq("is_active", true);

      const agencyContacts: Contact[] = (agencyStaff || [])
        .filter((as: any) => as.agencies && as.agencies.user_id)
        .map((as: any) => ({
          id: as.agencies.id,
          user_id: as.agencies.user_id,
          name: as.agencies.name || "Unknown Agency",
          type: "agency" as const,
          city: as.agencies.city,
        }));

      // Also get conversations the guard already has
      await loadExistingConversations(user.id, agencyContacts);

    } catch (err) {
      console.error("Error loading contacts:", err);
      setError("Failed to load contacts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingConversations = async (userId: string, existingContacts: Contact[] = []) => {
    try {
      const { data: existingConvs } = await supabase
        .from("conversations")
        .select("id, participant1_id, participant2_id")
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`);

      const otherUserIds = (existingConvs || [])
        .map((c) => c.participant1_id === userId ? c.participant2_id : c.participant1_id)
        .filter((id) => !existingContacts.find((c) => c.user_id === id));

      if (otherUserIds.length > 0) {
        // Get venue contacts
        const { data: venues } = await supabase
          .from("venues")
          .select("id, user_id, name, city")
          .in("user_id", otherUserIds);

        const venueContacts: Contact[] = (venues || [])
          .filter((v: any) => v.user_id)
          .map((v: any) => ({
            id: v.id,
            user_id: v.user_id,
            name: v.name || "Unknown Venue",
            type: "venue" as const,
            city: v.city,
          }));

        // Get agency contacts from conversations
        const { data: agencies } = await supabase
          .from("agencies")
          .select("id, user_id, name, city")
          .in("user_id", otherUserIds);

        const agencyConvContacts: Contact[] = (agencies || [])
          .filter((a: any) => a.user_id)
          .map((a: any) => ({
            id: a.id,
            user_id: a.user_id,
            name: a.name || "Unknown Agency",
            type: "agency" as const,
            city: a.city,
          }));

        const allContacts = [...existingContacts];
        [...venueContacts, ...agencyConvContacts].forEach((c) => {
          if (!allContacts.find((ec) => ec.user_id === c.user_id)) {
            allContacts.push(c);
          }
        });

        setContacts(allContacts);

        // Auto-select first contact if available
        if (allContacts.length > 0 && !selectedContact) {
          selectContact(allContacts[0], userId);
        }
      } else {
        setContacts(existingContacts);
        if (existingContacts.length > 0 && !selectedContact) {
          selectContact(existingContacts[0], userId);
        }
      }
    } catch (err) {
      console.error("Error loading existing conversations:", err);
    }
  };

  const selectContact = async (contact: Contact, userId?: string) => {
    const uid = userId || currentUserId;
    if (!uid || !contact.user_id) return;

    setSelectedContact(contact);
    setMessages([]);
    setConversation(null);

    try {
      // Check for existing conversation - try both orderings
      const { data: existingConv, error: existingError } = await supabase
        .from("conversations")
        .select("*")
        .or(`and(participant1_id.eq.${uid},participant2_id.eq.${contact.user_id}),and(participant1_id.eq.${contact.user_id},participant2_id.eq.${uid})`)
        .maybeSingle();

      if (existingError) {
        console.error("Error checking conversation:", existingError);
      }

      if (existingConv) {
        setConversation(existingConv);
        loadMessages(existingConv.id);
      } else {
        // Create new conversation
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            participant1_id: uid,
            participant2_id: contact.user_id,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating conversation:", createError);
          return;
        }

        if (newConv) {
          setConversation(newConv);
        }
      }
    } catch (err) {
      console.error("Error selecting contact:", err);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        return;
      }

      setMessages(data || []);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation || !currentUserId || isSending) {
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: currentUserId,
        content: newMessage.trim(),
      }).select();

      if (error) {
        console.error("Error sending message:", error);
        return;
      }

      setNewMessage("");
      // Manually add message to state
      if (data && data[0]) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data[0].id)) {
            return prev;
          }
          return [...prev, data[0]];
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // Filter contacts by search
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Error state
  if (error) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-6">
        <div className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mx-auto mb-4">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-zinc-400">{error}</p>
          <button
            onClick={() => loadContacts()}
            className="mt-4 rounded-lg bg-shield-500 px-4 py-2 text-sm text-white hover:bg-shield-400"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">💬</span> Messages
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Chat with agencies and venues
        </p>
      </div>

      {/* Main Content - Split View */}
      <div className="flex flex-1 gap-4 overflow-hidden rounded-2xl">
        {/* Contacts List Sidebar */}
        <div className={`glass w-80 shrink-0 overflow-hidden rounded-2xl ${selectedContact ? "hidden md:block" : ""}`}>
          <div className="border-b border-white/5 p-4">
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
            />
          </div>
          <div className="h-full overflow-y-auto pb-20">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mx-auto mb-3">
                  <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-400">
                  {contacts.length === 0 ? "No contacts yet" : "No results found"}
                </p>
                {contacts.length === 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Join an agency to start messaging
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredContacts.map((contact) => {
                  const isSelected = selectedContact?.id === contact.id;

                  return (
                    <button
                      key={contact.id}
                      onClick={() => selectContact(contact)}
                      className={`flex w-full items-center gap-3 p-4 text-left transition ${
                        isSelected
                          ? "bg-shield-500/20 border-l-2 border-shield-500"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white ${
                          contact.type === "venue"
                            ? "bg-gradient-to-br from-purple-500 to-pink-500"
                            : "bg-gradient-to-br from-blue-500 to-cyan-500"
                        }`}
                      >
                        {(contact.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium truncate ${isSelected ? "text-white" : "text-zinc-300"}`}>
                          {contact.name || "Unknown"}
                        </p>
                        <p className="text-xs text-zinc-500 capitalize">
                          {contact.type} {contact.city && `• ${contact.city}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`glass flex flex-1 flex-col overflow-hidden rounded-2xl ${!selectedContact ? "hidden md:flex" : ""}`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-white/5 p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="md:hidden text-zinc-400 hover:text-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white ${
                      selectedContact.type === "venue"
                        ? "bg-gradient-to-br from-purple-500 to-pink-500"
                        : "bg-gradient-to-br from-blue-500 to-cyan-500"
                    }`}
                  >
                    {(selectedContact.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{selectedContact.name || "Unknown"}</h3>
                    <p className="text-xs text-zinc-500 capitalize">
                      {selectedContact.type} {selectedContact.city && `• ${selectedContact.city}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedContact.user_id && (
                    <CallButton
                      targetUserId={selectedContact.user_id}
                      targetName={selectedContact.name || "Unknown"}
                      variant="icon"
                    />
                  )}
                  <button className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                      <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm text-zinc-400">No messages yet</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Send a message to start the conversation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedMessages).map(([date, msgs]) => (
                      <div key={date}>
                        <div className="flex items-center justify-center py-2">
                          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-500">
                            {formatDate(msgs[0].created_at)}
                          </span>
                        </div>
                        {msgs.map((msg) => {
                          const isMe = msg.sender_id === currentUserId;
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                  isMe
                                    ? "bg-shield-500 text-white"
                                    : "bg-white/5 text-zinc-200"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <p className={`mt-1 text-xs ${isMe ? "text-shield-200" : "text-zinc-500"}`}>
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="border-t border-white/5 p-4">
                <div className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={`Message ${selectedContact.name || "contact"}...`}
                      rows={1}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
                      style={{ maxHeight: "120px" }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || isSending || !conversation}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-shield-500 text-white transition hover:bg-shield-400 disabled:opacity-50"
                  >
                    {isSending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-shield-500/20 to-shield-600/20">
                <span className="text-4xl">💬</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-medium text-white">
                Select a Contact
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Choose someone from the sidebar to start messaging
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
