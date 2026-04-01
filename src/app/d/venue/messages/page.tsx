"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface Contact {
  id: string;
  user_id: string;
  name: string;
  type: "personnel" | "agency";
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

export default function VenueMessagesPage() {
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

  useEffect(() => { loadContacts(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      })
      .subscribe();

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages((prev) => data.length !== prev.length ? data : prev);
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
      if (authError || !user) { setError("Please sign in to view messages"); setIsLoading(false); return; }
      setCurrentUserId(user.id);

      // Get venue record
      const { data: venue } = await supabase
        .from("venues")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Load contacts from existing conversations
      const { data: existingConvs } = await supabase
        .from("conversations")
        .select("id, participant1_id, participant2_id")
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

      const otherUserIds = (existingConvs || [])
        .map((c) => c.participant1_id === user.id ? c.participant2_id : c.participant1_id);

      const allContacts: Contact[] = [];

      if (otherUserIds.length > 0) {
        const { data: personnelUsers } = await supabase
          .from("personnel")
          .select("id, user_id, display_name, city")
          .in("user_id", otherUserIds);

        (personnelUsers || []).forEach((p: any) => {
          if (p.user_id) {
            allContacts.push({ id: p.id, user_id: p.user_id, name: p.display_name || "Unknown", type: "personnel", city: p.city });
          }
        });

        const { data: agencyUsers } = await supabase
          .from("agencies")
          .select("id, user_id, name, city")
          .in("user_id", otherUserIds);

        (agencyUsers || []).forEach((a: any) => {
          if (a.user_id) {
            allContacts.push({ id: a.id, user_id: a.user_id, name: a.name || "Unknown Agency", type: "agency", city: a.city });
          }
        });
      }

      // Also load personnel who have worked shifts for this venue
      if (venue) {
        const { data: shiftPersonnel } = await supabase
          .from("shifts")
          .select("personnel_id, personnel:personnel_id(id, user_id, display_name, city)")
          .eq("booking_id", venue.id)
          .not("personnel_id", "is", null)
          .limit(20);

        // Deduplicate — get unique contacts from bookings
        const { data: bookingShifts } = await supabase
          .from("bookings")
          .select("id")
          .eq("venue_id", venue.id);

        if (bookingShifts && bookingShifts.length > 0) {
          const bookingIds = bookingShifts.map((b) => b.id);
          const { data: shiftStaff } = await supabase
            .from("shifts")
            .select("personnel:personnel_id(id, user_id, display_name, city)")
            .in("booking_id", bookingIds)
            .not("personnel_id", "is", null);

          (shiftStaff || []).forEach((s: any) => {
            const p = s.personnel;
            if (p?.user_id && !allContacts.find((c) => c.user_id === p.user_id)) {
              allContacts.push({ id: p.id, user_id: p.user_id, name: p.display_name || "Unknown", type: "personnel", city: p.city });
            }
          });
        }
      }

      setContacts(allContacts);
      if (allContacts.length > 0) {
        selectContact(allContacts[0], user.id);
      }
    } catch (err) {
      setError("Failed to load contacts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectContact = async (contact: Contact, userId?: string) => {
    const uid = userId || currentUserId;
    if (!uid || !contact.user_id) return;
    setSelectedContact(contact);
    setMessages([]);
    setConversation(null);
    try {
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("*")
        .or(`and(participant1_id.eq.${uid},participant2_id.eq.${contact.user_id}),and(participant1_id.eq.${contact.user_id},participant2_id.eq.${uid})`)
        .maybeSingle();
      if (existingConv) {
        setConversation(existingConv);
        loadMessages(existingConv.id);
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ participant1_id: uid, participant2_id: contact.user_id })
          .select()
          .single();
        if (newConv) setConversation(newConv);
      }
    } catch (err) { /* ignore */ }
  };

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation || !currentUserId || isSending) return;
    setIsSending(true);
    try {
      const { data } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: currentUserId,
        content: newMessage.trim(),
      }).select();
      setNewMessage("");
      if (data?.[0]) {
        setMessages((prev) => prev.some((m) => m.id === data[0].id) ? prev : [...prev, data[0]]);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const groupedMessages = messages.reduce((groups: Record<string, Message[]>, msg) => {
    const date = new Date(msg.created_at).toDateString();
    (groups[date] ??= []).push(msg);
    return groups;
  }, {});

  const filteredContacts = contacts.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (error) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <p className="text-zinc-400">{error}</p>
          <button onClick={loadContacts} className="mt-4 rounded-lg bg-[#00d4aa] px-4 py-2 text-sm text-[#0c0d10] font-semibold hover:bg-[#00e5b8]">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold text-white">Messages</h1>
        <p className="mt-1 text-sm text-zinc-400">Chat with your security staff</p>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden rounded-2xl">
        {/* Contacts sidebar */}
        <div className={`glass w-80 shrink-0 overflow-hidden rounded-2xl ${selectedContact ? "hidden md:block" : ""}`}>
          <div className="border-b border-white/5 p-4">
            <input type="text" placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#00d4aa]/50" />
          </div>
          <div className="h-full overflow-y-auto pb-20">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00d4aa] border-t-transparent" /></div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-400">{contacts.length === 0 ? "No contacts yet" : "No results found"}</p>
                {contacts.length === 0 && <p className="mt-2 text-xs text-zinc-500">Contacts appear when staff are booked for your events</p>}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredContacts.map((contact) => (
                  <button key={contact.id} onClick={() => selectContact(contact)} className={`flex w-full items-center gap-3 p-4 text-left transition ${selectedContact?.id === contact.id ? "bg-[#00d4aa]/10 border-l-2 border-[#00d4aa]" : "hover:bg-white/[0.02]"}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white ${contact.type === "personnel" ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-blue-500 to-indigo-600"}`}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium truncate ${selectedContact?.id === contact.id ? "text-white" : "text-zinc-300"}`}>{contact.name}</p>
                      <p className="text-xs text-zinc-500 capitalize">{contact.type}{contact.city && ` · ${contact.city}`}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`glass flex flex-1 flex-col overflow-hidden rounded-2xl ${!selectedContact ? "hidden md:flex" : ""}`}>
          {selectedContact ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/5 p-4">
                <button onClick={() => setSelectedContact(null)} className="md:hidden text-zinc-400 hover:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white ${selectedContact.type === "personnel" ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-blue-500 to-indigo-600"}`}>
                  {selectedContact.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-white">{selectedContact.name}</h3>
                  <p className="text-xs text-zinc-500 capitalize">{selectedContact.type}{selectedContact.city && ` · ${selectedContact.city}`}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                      <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <p className="mt-4 text-sm text-zinc-400">No messages yet</p>
                    <p className="mt-1 text-xs text-zinc-500">Send a message to start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedMessages).map(([date, msgs]) => (
                      <div key={date}>
                        <div className="flex items-center justify-center py-2">
                          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-500">{formatDate(msgs[0].created_at)}</span>
                        </div>
                        {msgs.map((msg) => {
                          const isMe = msg.sender_id === currentUserId;
                          return (
                            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? "bg-[#00d4aa] text-[#0c0d10]" : "bg-white/5 text-zinc-200"}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <p className={`mt-1 text-xs ${isMe ? "text-[#0c0d10]/60" : "text-zinc-500"}`}>{formatTime(msg.created_at)}</p>
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

              <div className="border-t border-white/5 p-4">
                <div className="flex items-end gap-2">
                  <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder={`Message ${selectedContact.name}...`} rows={1} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#00d4aa]/50" style={{ maxHeight: "120px" }} />
                  <button onClick={handleSend} disabled={!newMessage.trim() || isSending || !conversation} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00d4aa] text-[#0c0d10] transition hover:bg-[#00e5b8] disabled:opacity-50">
                    {isSending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0c0d10] border-t-transparent" /> : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#00d4aa]/20 to-[#0d9488]/20">
                <span className="text-4xl">💬</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-medium text-white">Select a Contact</h3>
              <p className="mt-2 text-sm text-zinc-400">Choose someone from the sidebar to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
