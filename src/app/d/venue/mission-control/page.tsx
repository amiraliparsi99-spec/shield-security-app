"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase } from "@/hooks/useSupabase";
import Link from "next/link";
import {
  getMissionControlChats,
  getGroupChat,
  getGroupChatMessages,
  sendGroupMessage,
  sendLocationPin,
  sendCheckInMessage,
  markMessagesAsRead,
  subscribeToGroupChat,
  type GroupChat,
  type GroupChatMember,
  type GroupChatMessage,
} from "@/lib/db/mission-control";
import {
  fetchBookingStatusesForIds,
  fetchShiftSummariesForBookings,
  matchesPassedSubFilter,
  venueMissionMeta,
  type MissionBucket,
  type PassedSubFilter,
  type ShiftMissionSummary,
} from "@/lib/mission-control/chatBuckets";
import { CallButton } from "@/components/calling/CallButton";

export default function MissionControlPage() {
  const supabase = useSupabase();
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [shiftsByBooking, setShiftsByBooking] = useState<
    Record<string, ShiftMissionSummary[]>
  >({});
  const [bookingById, setBookingById] = useState<Record<string, { status: string }>>(
    {}
  );
  const [bucketTab, setBucketTab] = useState<MissionBucket>("live");
  const [passedSubFilter, setPassedSubFilter] = useState<PassedSubFilter>("all");
  const [activeChat, setActiveChat] = useState<GroupChat | null>(null);
  const [activeShiftCover, setActiveShiftCover] = useState<{
    searching: number;
    failed: number;
    replacementFound: number;
    note: string | null;
  } | null>(null);
  const [members, setMembers] = useState<GroupChatMember[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [requestingReport, setRequestingReport] = useState(false);
  const didPickInitialChat = useRef(false);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, [supabase]);

  const visibleChats = useMemo(
    () =>
      chats.filter((c) => {
        const meta = venueMissionMeta(
          c.booking_id,
          c.booking_id ? bookingById[c.booking_id]?.status : undefined,
          c.booking_id ? shiftsByBooking[c.booking_id] : undefined
        );
        if (bucketTab === "live") return meta.bucket === "live";
        if (!matchesPassedSubFilter(meta.bucket, meta.passedKind, passedSubFilter)) {
          return false;
        }
        return meta.bucket === "passed";
      }),
    [chats, bucketTab, passedSubFilter, shiftsByBooking, bookingById]
  );

  // Subscribe to messages when chat is selected
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeChat || !userId) return;
    ensureRatingPrompts(activeChat, messages);
  }, [activeChat, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectChat = async (chat: GroupChat) => {
    setActiveChat(chat);
    
    const [chatData, messagesData] = await Promise.all([
      getGroupChat(supabase, chat.id),
      getGroupChatMessages(supabase, chat.id),
    ]);
    
    setMembers(chatData.members);
    setMessages(messagesData);
    markMessagesAsRead(supabase, chat.id);
    ensureRatingPrompts(chat, messagesData);

    if (chat.booking_id) {
      const { data: shifts } = await supabase
        .from("shifts")
        .select("dispatcher_status, withdrawal_reason")
        .eq("booking_id", chat.booking_id);

      const searching =
        shifts?.filter((s: any) => s.dispatcher_status === "searching").length ?? 0;
      const failed =
        shifts?.filter((s: any) => s.dispatcher_status === "failed").length ?? 0;
      const replacementFound =
        shifts?.filter((s: any) => s.dispatcher_status === "replacement_found").length ?? 0;
      const latestNote =
        (shifts || [])
          .map((s: any) => (typeof s.withdrawal_reason === "string" ? s.withdrawal_reason.trim() : ""))
          .find(Boolean) || null;

      setActiveShiftCover({ searching, failed, replacementFound, note: latestNote });
    } else {
      setActiveShiftCover(null);
    }
  };

  // Load chats + shift/booking summaries for Live / Passed buckets
  useEffect(() => {
    const loadChats = async () => {
      setLoading(true);
      try {
        const data = await getMissionControlChats(supabase);
        setChats(data as GroupChat[]);
        const bookingIds = [
          ...new Set(
            (data as GroupChat[]).map((c) => c.booking_id).filter(Boolean)
          ),
        ] as string[];
        const [shiftsMap, bookingsMap] = await Promise.all([
          fetchShiftSummariesForBookings(supabase, bookingIds),
          fetchBookingStatusesForIds(supabase, bookingIds),
        ]);
        setShiftsByBooking(shiftsMap);
        setBookingById(bookingsMap);

        const metaFor = (c: GroupChat) =>
          venueMissionMeta(
            c.booking_id,
            c.booking_id ? bookingsMap[c.booking_id]?.status : undefined,
            c.booking_id ? shiftsMap[c.booking_id] : undefined
          );

        const firstLive = (data as GroupChat[]).find(
          (c) => metaFor(c).bucket === "live"
        );
        const firstPassed = (data as GroupChat[]).find(
          (c) => metaFor(c).bucket === "passed"
        );
        const pick = firstLive || firstPassed || null;
        if (pick && !didPickInitialChat.current) {
          didPickInitialChat.current = true;
          void selectChat(pick);
        }
      } catch (e) {
        console.error("Error loading chats:", e);
      } finally {
        setLoading(false);
      }
    };
    loadChats();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeChat) return;
    const stillVisible = visibleChats.some((c) => c.id === activeChat.id);
    if (stillVisible) return;
    if (visibleChats.length > 0) {
      void selectChat(visibleChats[0]);
    } else {
      setActiveChat(null);
      setMembers([]);
      setMessages([]);
      setActiveShiftCover(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectChat closes over latest supabase/helpers
  }, [bucketTab, passedSubFilter, visibleChats, activeChat]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChat || sending) return;

    setSending(true);
    const { success } = await sendGroupMessage(
      supabase,
      activeChat.id,
      newMessage.trim()
    );
    
    if (success) {
      setNewMessage("");
    }
    setSending(false);
  };

  const handleQuickAction = async (action: string) => {
    if (!activeChat) return;

    setSending(true);
    switch (action) {
      case "arriving":
        await sendCheckInMessage(supabase, activeChat.id, "arriving");
        break;
      case "on_site":
        await sendCheckInMessage(supabase, activeChat.id, "on_site");
        break;
      case "position":
        await sendCheckInMessage(supabase, activeChat.id, "position");
        break;
      case "break":
        await sendCheckInMessage(supabase, activeChat.id, "break");
        break;
      case "leaving":
        await sendCheckInMessage(supabase, activeChat.id, "leaving");
        break;
      case "location":
        // Get current location and send
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            await sendLocationPin(
              supabase,
              activeChat.id,
              "My Location",
              pos.coords.latitude,
              pos.coords.longitude
            );
          });
        }
        break;
    }
    setShowQuickActions(false);
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const getMemberName = (senderId: string) => {
    const member = members.find(m => m.user_id === senderId);
    return member?.display_name || "Unknown";
  };

  const getMemberRole = (senderId: string) => {
    const member = members.find(m => m.user_id === senderId);
    return member?.role || "member";
  };

  const resolveReviewerId = async (authUserId: string): Promise<string> => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();
    return profile?.id ?? authUserId;
  };

  const ensureRatingPrompts = async (chat: GroupChat, existingMessages: GroupChatMessage[]) => {
    if (!chat.booking_id || !userId) return;

    const { data: completedShifts } = await supabase
      .from("shifts")
      .select("id, booking_id, personnel_id, role")
      .eq("booking_id", chat.booking_id)
      .eq("status", "checked_out")
      .not("personnel_id", "is", null);

    if (!completedShifts || completedShifts.length === 0) return;

    const personnelIds = Array.from(new Set(completedShifts.map((s: any) => s.personnel_id).filter(Boolean)));
    const { data: personnelRows } = await supabase
      .from("personnel")
      .select("id, display_name, user_id")
      .in("id", personnelIds);
    const personnelById: Record<string, { display_name?: string; user_id?: string | null }> = {};
    (personnelRows || []).forEach((p: any) => {
      personnelById[p.id] = p;
    });

    const reviewerId = await resolveReviewerId(userId);
    const reviewerCandidates = reviewerId === userId ? [userId] : [userId, reviewerId];
    const { data: existingReviews } = await supabase
      .from("reviews")
      .select("booking_id, reviewee_id")
      .eq("booking_id", chat.booking_id)
      .in("reviewer_id", reviewerCandidates)
      .in("reviewee_id", personnelIds);

    const reviewedPairs = new Set(
      (existingReviews || [])
        .map((r: any) => (r.booking_id && r.reviewee_id ? `${r.booking_id}:${r.reviewee_id}` : null))
        .filter(Boolean),
    );

    const promptedPairs = new Set(
      existingMessages
        .map((m) =>
          m.message_type === "system" &&
          m.metadata?.type === "rating_request" &&
          m.metadata?.booking_id &&
          m.metadata?.personnel_id
            ? `${m.metadata.booking_id}:${m.metadata.personnel_id}`
            : null,
        )
        .filter(Boolean) as string[],
    );

    for (const shift of completedShifts as any[]) {
      if (!shift.booking_id || !shift.personnel_id) continue;
      const key = `${shift.booking_id}:${shift.personnel_id}`;
      if (reviewedPairs.has(key) || promptedPairs.has(key)) continue;

      const staff = personnelById[shift.personnel_id];
      const staffName = staff?.display_name || "this staff member";
      await sendGroupMessage(
        supabase,
        chat.id,
        `⭐ Rate this staff: ${staffName} completed their shift. Tap below to rate now.`,
        "system",
        {
          type: "rating_request",
          booking_id: shift.booking_id,
          personnel_id: shift.personnel_id,
          personnel_user_id: staff?.user_id || null,
          role: shift.role || "Security",
        },
      );
    }
  };

  const handleRequestIncidentReport = async () => {
    if (!activeChat || requestingReport) return;
    
    setRequestingReport(true);
    try {
      // Get the booking's shifts to find personnel
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, personnel_id, status")
        .eq("booking_id", activeChat.booking_id)
        .eq("status", "checked_out");

      if (!shifts || shifts.length === 0) {
        alert("No completed shifts found for this booking.");
        setRequestingReport(false);
        return;
      }

      // Update shifts to request incident reports
      for (const shift of shifts) {
        await supabase
          .from("shifts")
          .update({
            incident_report_requested: true,
            incident_report_requested_at: new Date().toISOString(),
            incident_report_requested_by: userId,
          })
          .eq("id", shift.id);
      }

      // Send a message in Mission Control
      await sendGroupMessage(
        supabase,
        activeChat.id,
        "📋 **Incident Report Requested**\n\nPlease submit a post-shift incident report for this shift. Tap here to fill out the report.",
        "system",
        { 
          type: "incident_report_request",
          shift_ids: shifts.map(s => s.id),
          action: "request_incident_report"
        }
      );

      alert("Incident report request sent to the team!");
    } catch (error) {
      console.error("Error requesting incident report:", error);
      alert("Failed to request incident report. Please try again.");
    } finally {
      setRequestingReport(false);
    }
  };

  const getMessageStyle = (msg: GroupChatMessage) => {
    const isOwn = msg.sender_id === userId;
    const isSystem = msg.message_type === "system";
    const metaType = msg.metadata?.type as string | undefined;

    if (isSystem) {
      if (metaType === "rating_request") {
        return "mx-auto w-full max-w-xl bg-purple-500/10 border border-purple-500/30 text-purple-100";
      }
      if (metaType === "shift_checkin_confirmed") {
        return "mx-auto w-full max-w-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 text-left text-sm whitespace-pre-wrap";
      }
      if (metaType === "shift_checkout_confirmed") {
        return "mx-auto w-full max-w-xl bg-blue-500/10 border border-blue-500/30 text-blue-100 text-left text-sm whitespace-pre-wrap";
      }
      if (metaType?.startsWith("shift_reminder")) {
        return "mx-auto w-full max-w-xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-left text-sm whitespace-pre-wrap";
      }
      return "mx-auto bg-zinc-800/50 text-zinc-400 text-center text-xs px-4 py-2 rounded-full";
    }
    
    if (isOwn) {
      return "ml-auto bg-purple-500/20 border border-purple-500/30 text-white";
    }
    
    return "bg-zinc-900 border border-white/10 text-white";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-black">
      {/* Chat List Sidebar */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-zinc-950">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            🎯 Mission Control
          </h1>
          <p className="text-sm text-zinc-400">Team communication for events</p>
        </div>

        <div className="px-3 pb-2 border-b border-white/5 space-y-2">
          <div className="flex rounded-lg bg-zinc-900 p-0.5 gap-0.5">
            {(["live", "passed"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setBucketTab(tab);
                  if (tab === "live") setPassedSubFilter("all");
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  bucketTab === tab
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab === "live" ? "Live" : "Passed"}
              </button>
            ))}
          </div>
          {bucketTab === "passed" && (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "all" as const, label: "All" },
                  { id: "cancelled" as const, label: "Cancelled" },
                  { id: "completed" as const, label: "Completed" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPassedSubFilter(id)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition ${
                    passedSubFilter === id
                      ? "border-purple-500/60 bg-purple-500/20 text-purple-100"
                      : "border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.length > 0 ? (
            visibleChats.length > 0 ? (
              visibleChats.map((chat) => {
                const rowMeta = venueMissionMeta(
                  chat.booking_id,
                  chat.booking_id ? bookingById[chat.booking_id]?.status : undefined,
                  chat.booking_id ? shiftsByBooking[chat.booking_id] : undefined
                );
                return (
                  <button
                    key={chat.id}
                    onClick={() => selectChat(chat)}
                    className={`w-full p-4 text-left border-b border-white/5 transition ${
                      activeChat?.id === chat.id
                        ? "bg-purple-500/10"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <span className="text-lg">🛡️</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{chat.name}</p>
                        <p className="text-xs text-zinc-500">
                          {chat.event_date && formatDate(chat.event_date)}
                          {rowMeta.bucket === "passed" && rowMeta.passedKind === "cancelled" ? (
                            <span className="ml-1.5 text-amber-400/90">· Cancelled</span>
                          ) : null}
                        </p>
                      </div>
                      {rowMeta.bucket === "live" && chat.is_active && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-sm text-zinc-500">
                {bucketTab === "live"
                  ? "No live missions. Open Passed to see ended or cancelled events."
                  : passedSubFilter === "cancelled"
                    ? "No cancelled shifts in Passed for this filter."
                    : passedSubFilter === "completed"
                      ? "No completed-only missions match this filter."
                      : "Nothing in Passed yet."}
              </div>
            )
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-white font-medium mb-2">No Active Missions</h3>
              <p className="text-sm text-zinc-500">
                Mission Control chats are automatically created when bookings are confirmed with assigned staff.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{activeChat.name}</h2>
                <p className="text-sm text-zinc-400">
                  {members.length} team members • {activeChat.event_date && formatDate(activeChat.event_date)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Incident Report Button */}
                <button
                  onClick={handleRequestIncidentReport}
                  disabled={requestingReport}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition disabled:opacity-50"
                  title="Request Incident Report"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">
                    {requestingReport ? "Sending..." : "Request Report"}
                  </span>
                </button>

                {/* Team Members with Call Buttons */}
                <div className="flex items-center gap-2">
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
                </div>
                {members.filter(m => m.user_id !== userId).length > 4 && (
                  <span className="text-xs text-zinc-500">
                    +{members.filter(m => m.user_id !== userId).length - 4} more
                  </span>
                )}
              </div>
            </div>
            {activeShiftCover && (activeShiftCover.searching > 0 || activeShiftCover.failed > 0 || activeShiftCover.replacementFound > 0) ? (
              <div className="mt-3 space-y-2">
                {activeShiftCover.searching > 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    Searching for replacement cover ({activeShiftCover.searching} shift{activeShiftCover.searching === 1 ? "" : "s"} in search).
                  </div>
                ) : null}
                {activeShiftCover.failed > 0 ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    Replacement search failed for {activeShiftCover.failed} shift{activeShiftCover.failed === 1 ? "" : "s"}. Manual action needed.
                  </div>
                ) : null}
                {activeShiftCover.replacementFound > 0 ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    Replacement found for {activeShiftCover.replacementFound} shift{activeShiftCover.replacementFound === 1 ? "" : "s"}.
                  </div>
                ) : null}
                {activeShiftCover.note ? (
                  <p className="text-xs text-zinc-500">Latest withdrawal reason: {activeShiftCover.note}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${getMessageStyle(msg)}`}
              >
                {msg.message_type !== "system" && msg.sender_id !== userId && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-purple-400">
                      {getMemberName(msg.sender_id)}
                    </span>
                    {getMemberRole(msg.sender_id) === "owner" && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                        Manager
                      </span>
                    )}
                  </div>
                )}
                
                {msg.message_type === "location" && msg.metadata?.latitude && (
                  <div className="mb-2 p-2 rounded-lg bg-black/30">
                    <a
                      href={`https://www.google.com/maps?q=${msg.metadata.latitude},${msg.metadata.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm flex items-center gap-1"
                    >
                      📍 Open in Maps
                    </a>
                  </div>
                )}
                
                {msg.message_type === "checkin" && (
                  <span className="mr-2">
                    {msg.metadata?.status === "arriving" && "🚗"}
                    {msg.metadata?.status === "on_site" && "✅"}
                    {msg.metadata?.status === "position" && "📍"}
                    {msg.metadata?.status === "break" && "☕"}
                    {msg.metadata?.status === "leaving" && "👋"}
                  </span>
                )}
                
                <p className="text-sm">{msg.content}</p>

                {msg.message_type === "system" && msg.metadata?.type === "rating_request" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.metadata?.personnel_id && (
                      <Link
                        href={`/d/venue/ratings?booking=${encodeURIComponent(String(msg.metadata.booking_id || ""))}&staff=${encodeURIComponent(String(msg.metadata.personnel_id))}`}
                        className="inline-flex items-center rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-600 transition"
                      >
                        Rate this staff
                      </Link>
                    )}
                    {msg.metadata?.personnel_id && (
                      <Link
                        href={`/d/venue/personnel/${encodeURIComponent(String(msg.metadata.personnel_id))}`}
                        className="inline-flex items-center rounded-lg bg-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/15 transition"
                      >
                        Open profile
                      </Link>
                    )}
                  </div>
                )}

                {/* Live Check-In link on venue reminder messages */}
                {msg.message_type === "system" &&
                  (msg.metadata?.type === "shift_reminder_pre_start_venue" ||
                    msg.metadata?.type === "shift_reminder_start_attendance" ||
                    msg.metadata?.type === "shift_checkin_confirmed") && (
                    <div className="mt-3">
                      <Link
                        href="/d/venue/live"
                        className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition"
                      >
                        Open Live Check-In
                      </Link>
                    </div>
                  )}
                
                {msg.message_type !== "system" && (
                  <p className="text-xs text-zinc-500 mt-1">{formatTime(msg.created_at)}</p>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
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
                    { id: "location", icon: "🗺️", label: "Share location" },
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
                  showQuickActions ? "bg-purple-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
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
                className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-3 rounded-xl bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎯</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Select a Mission</h2>
            <p className="text-zinc-500">Choose a chat from the sidebar to start communicating</p>
          </div>
        </div>
      )}
    </div>
  );
}
