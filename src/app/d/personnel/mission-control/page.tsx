"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { LocationMessageCard } from "@/components/mission-control/LocationMessageCard";
import {
  fetchBookingStatusesForIds,
  fetchShiftSummariesForBookings,
  matchesPassedSubFilter,
  personnelMissionMeta,
  type MissionBucket,
  type PassedSubFilter,
  type ShiftMissionSummary,
} from "@/lib/mission-control/chatBuckets";
import { CallButton } from "@/components/calling/CallButton";

type ShiftForChat = {
  id: string;
  booking_id: string;
  status: string;
  role: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  hourly_rate: number;
};

export default function PersonnelMissionControlPage() {
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
  const [personnelPid, setPersonnelPid] = useState<string | null>(null);
  const didPickInitialChat = useRef(false);
  const [activeChat, setActiveChat] = useState<GroupChat | null>(null);
  const [members, setMembers] = useState<GroupChatMember[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [activeShift, setActiveShift] = useState<ShiftForChat | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState("0:00:00");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) {
      setPersonnelPid(null);
      return;
    }
    void supabase
      .from("personnel")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setPersonnelPid(data?.id ?? null));
  }, [userId, supabase]);

  useEffect(() => {
    if (!activeChat) return;
    const unsubscribe = subscribeToGroupChat(
      supabase,
      activeChat.id,
      (newMsg) => {
        setMessages((prev) => [...prev, newMsg]);
        markMessagesAsRead(supabase, activeChat.id);
      },
    );
    return () => unsubscribe();
  }, [activeChat, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Elapsed time ticker for checked-in shifts
  useEffect(() => {
    if (activeShift?.status !== "checked_in" || !activeShift.actual_start)
      return;
    const update = () => {
      const diff =
        Date.now() - new Date(activeShift.actual_start!).getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setElapsedTime(
        `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [activeShift]);

  const loadShiftForChat = useCallback(
    async (chat: GroupChat) => {
      if (!chat.booking_id || !userId) {
        setActiveShift(null);
        return;
      }
      setShiftLoading(true);
      try {
        const { data: personnel } = await supabase
          .from("personnel")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!personnel?.id) {
          setActiveShift(null);
          return;
        }

        const { data: shifts } = await supabase
          .from("shifts")
          .select(
            "id, booking_id, status, role, scheduled_start, scheduled_end, actual_start, hourly_rate",
          )
          .eq("booking_id", chat.booking_id)
          .eq("personnel_id", personnel.id)
          .in("status", ["accepted", "checked_in", "pending"])
          .order("scheduled_start", { ascending: true })
          .limit(1);

        setActiveShift((shifts && shifts.length > 0 ? shifts[0] : null) as ShiftForChat | null);
      } catch (e) {
        console.error("Error loading shift:", e);
        setActiveShift(null);
      } finally {
        setShiftLoading(false);
      }
    },
    [supabase, userId],
  );

  useEffect(() => {
    if (activeChat && userId) loadShiftForChat(activeChat);
  }, [activeChat, userId, loadShiftForChat]);

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

  const visibleChats = useMemo(() => {
    if (!personnelPid) {
      return bucketTab === "live" ? chats : [];
    }
    return chats.filter((c) => {
      const meta = personnelMissionMeta(
        personnelPid,
        c.booking_id,
        c.booking_id ? bookingById[c.booking_id]?.status : undefined,
        c.booking_id ? shiftsByBooking[c.booking_id] : undefined
      );
      if (bucketTab === "live") return meta.bucket === "live";
      if (!matchesPassedSubFilter(meta.bucket, meta.passedKind, passedSubFilter)) {
        return false;
      }
      return meta.bucket === "passed";
    });
  }, [
    chats,
    personnelPid,
    bucketTab,
    passedSubFilter,
    shiftsByBooking,
    bookingById,
  ]);

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

        const metaFor = (c: GroupChat, pid: string) =>
          personnelMissionMeta(
            pid,
            c.booking_id,
            c.booking_id ? bookingsMap[c.booking_id]?.status : undefined,
            c.booking_id ? shiftsMap[c.booking_id] : undefined
          );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const { data: pers } = await supabase
          .from("personnel")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        const pid = pers?.id;
        if (!pid) return;

        const firstLive = (data as GroupChat[]).find(
          (c) => metaFor(c, pid).bucket === "live"
        );
        const firstPassed = (data as GroupChat[]).find(
          (c) => metaFor(c, pid).bucket === "passed"
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketTab, passedSubFilter, visibleChats, activeChat]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChat || sending) return;
    setSending(true);
    const { success } = await sendGroupMessage(
      supabase,
      activeChat.id,
      newMessage.trim(),
    );
    if (success) setNewMessage("");
    setSending(false);
  };

  const handleQuickAction = async (action: string) => {
    if (!activeChat) return;
    setSending(true);

    const getCoords = (): Promise<{ latitude: number; longitude: number } | null> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
        );
      });

    switch (action) {
      case "arriving":
        await sendCheckInMessage(supabase, activeChat.id, "arriving");
        break;
      case "on_site": {
        const coords = await getCoords();
        await sendCheckInMessage(supabase, activeChat.id, "on_site", undefined, coords ?? undefined);
        break;
      }
      case "position": {
        const coords = await getCoords();
        await sendCheckInMessage(supabase, activeChat.id, "position", undefined, coords ?? undefined);
        break;
      }
      case "break":
        await sendCheckInMessage(supabase, activeChat.id, "break");
        break;
      case "leaving":
        await sendCheckInMessage(supabase, activeChat.id, "leaving");
        break;
      case "location": {
        const coords = await getCoords();
        if (coords) {
          await sendLocationPin(
            supabase,
            activeChat.id,
            "My Location",
            coords.latitude,
            coords.longitude,
          );
        }
        break;
      }
    }

    setShowQuickActions(false);
    setSending(false);
  };

  const getLocation = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
      );
    });

  const handleShiftCheckIn = async () => {
    if (!activeShift || activeShift.status !== "accepted") return;
    setCheckingIn(true);
    setLocationError(null);
    try {
      const loc = await getLocation();
      const res = await fetch("/api/shifts/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_id: activeShift.id,
          action: "check_in",
          latitude: loc.lat,
          longitude: loc.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Check-in failed");
        return;
      }
      setActiveShift((prev) =>
        prev
          ? { ...prev, status: "checked_in", actual_start: data.actual_start }
          : null,
      );
    } catch (e: any) {
      console.error(e);
      setLocationError(
        "Could not get your location. Enable location services and try again.",
      );
    } finally {
      setCheckingIn(false);
    }
  };

  const handleShiftCheckOut = async () => {
    if (!activeShift || activeShift.status !== "checked_in") return;
    setCheckingOut(true);
    setLocationError(null);
    try {
      const loc = await getLocation();
      const res = await fetch("/api/shifts/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_id: activeShift.id,
          action: "check_out",
          latitude: loc.lat,
          longitude: loc.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Check-out failed");
        return;
      }
      setActiveShift((prev) =>
        prev ? { ...prev, status: "checked_out" } : null,
      );
    } catch (e: any) {
      console.error(e);
      setLocationError(
        "Could not get your location. Enable location services and try again.",
      );
    } finally {
      setCheckingOut(false);
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const getMemberName = (senderId: string) =>
    members.find((m) => m.user_id === senderId)?.display_name || "Unknown";

  const getMemberRole = (senderId: string) =>
    members.find((m) => m.user_id === senderId)?.role || "member";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500" />
      </div>
    );
  }

  const isToday = activeShift
    ? new Date(activeShift.scheduled_start).toDateString() ===
      new Date().toDateString()
    : false;
  const canCheckIn =
    activeShift?.status === "accepted" && isToday;
  const canCheckOut = activeShift?.status === "checked_in";

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
                    ? "bg-shield-600 text-white"
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
                      ? "border-shield-500/60 bg-shield-500/20 text-shield-100"
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
                const rowMeta = personnelPid
                  ? personnelMissionMeta(
                      personnelPid,
                      chat.booking_id,
                      chat.booking_id ? bookingById[chat.booking_id]?.status : undefined,
                      chat.booking_id ? shiftsByBooking[chat.booking_id] : undefined
                    )
                  : { bucket: "live" as const, passedKind: "completed" as const };
                return (
                  <button
                    key={chat.id}
                    onClick={() => selectChat(chat)}
                    className={`w-full p-4 text-left border-b border-white/5 transition ${
                      activeChat?.id === chat.id
                        ? "bg-shield-500/10"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 flex items-center justify-center">
                        🛡️
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {chat.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {chat.event_date && formatDate(chat.event_date)}
                          {rowMeta.bucket === "passed" &&
                          rowMeta.passedKind === "cancelled" ? (
                            <span className="ml-1.5 text-amber-400/90">
                              · Cancelled
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-sm text-zinc-500">
                {bucketTab === "live"
                  ? "No live missions. Open Passed for ended or cancelled events."
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
                🎯
              </div>
              <h3 className="text-white font-medium mb-2">
                No Active Missions
              </h3>
              <p className="text-sm text-zinc-500">
                When you&apos;re assigned to a booking, Mission Control will
                appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="p-4 border-b border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {activeChat.name}
                </h2>
                <p className="text-sm text-zinc-400">
                  {members.length} team members
                  {activeChat.event_date
                    ? ` • ${formatDate(activeChat.event_date)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {members
                  .filter((m) => m.user_id !== userId)
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
                {members.filter((m) => m.user_id !== userId).length > 4 && (
                  <span className="text-xs text-zinc-500">
                    +
                    {members.filter((m) => m.user_id !== userId).length - 4}{" "}
                    more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Shift Status Bar ── */}
          {!shiftLoading && activeShift && (
            <div
              className={`px-4 py-3 border-b border-white/10 ${
                activeShift.status === "checked_in"
                  ? "bg-blue-500/10"
                  : canCheckIn
                    ? "bg-emerald-500/10"
                    : "bg-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">
                    {activeShift.status === "checked_in"
                      ? "🔵"
                      : canCheckIn
                        ? "🟢"
                        : "⏳"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {activeShift.role} —{" "}
                      {formatTime(activeShift.scheduled_start)}–
                      {formatTime(activeShift.scheduled_end)}
                    </p>
                    {activeShift.status === "checked_in" && (
                      <p className="text-lg font-mono text-blue-400">
                        {elapsedTime}
                      </p>
                    )}
                    {activeShift.status === "accepted" && !isToday && (
                      <p className="text-xs text-zinc-400">
                        Check-in available on{" "}
                        {formatDate(activeShift.scheduled_start)}
                      </p>
                    )}
                  </div>
                </div>

                {canCheckIn && (
                  <button
                    onClick={handleShiftCheckIn}
                    disabled={checkingIn}
                    className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-bold text-sm transition"
                  >
                    {checkingIn ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Locating...
                      </span>
                    ) : (
                      "📍 Check In"
                    )}
                  </button>
                )}

                {canCheckOut && (
                  <button
                    onClick={handleShiftCheckOut}
                    disabled={checkingOut}
                    className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-bold text-sm transition"
                  >
                    {checkingOut ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Processing...
                      </span>
                    ) : (
                      "🏁 Check Out"
                    )}
                  </button>
                )}

                {activeShift && (
                  <Link
                    href={`/d/personnel/shift/${activeShift.id}`}
                    className="text-xs text-shield-400 hover:text-shield-300 flex-shrink-0"
                  >
                    View shift →
                  </Link>
                )}
              </div>
              {locationError && (
                <p className="mt-2 text-xs text-red-400">{locationError}</p>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === userId;
              const isSystem = msg.message_type === "system";
              const metaType = msg.metadata?.type as string | undefined;

              const isShiftReminder =
                metaType?.startsWith("shift_reminder") ||
                metaType === "shift_checkin_confirmed" ||
                metaType === "shift_checkout_confirmed";

              const systemClass = isSystem
                ? isShiftReminder
                  ? "mx-auto w-full max-w-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 text-left text-sm whitespace-pre-wrap"
                  : "mx-auto bg-zinc-800/50 text-zinc-400 text-center text-xs"
                : "";

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    isSystem
                      ? systemClass
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
                  {msg.message_type === "location" && (
                    <LocationMessageCard metadata={msg.metadata} fallbackLabel="Shared location" />
                  )}
                  {msg.message_type === "checkin" && (
                    <LocationMessageCard metadata={msg.metadata} fallbackLabel="Live position" />
                  )}
                  <p className="text-sm">{msg.content}</p>

                  {/* Action buttons on shift reminder messages */}
                  {isSystem && metaType === "shift_reminder_pre_start_guard" && canCheckIn && (
                    <button
                      onClick={handleShiftCheckIn}
                      disabled={checkingIn}
                      className="mt-2 px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition disabled:opacity-50"
                    >
                      📍 Check In Now
                    </button>
                  )}
                  {isSystem && metaType === "shift_reminder_pre_end_checkout" && canCheckOut && (
                    <button
                      onClick={handleShiftCheckOut}
                      disabled={checkingOut}
                      className="mt-2 px-4 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition disabled:opacity-50"
                    >
                      🏁 Check Out Now
                    </button>
                  )}

                  {!isSystem && (
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatTime(msg.created_at)}
                    </p>
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
                  showQuickActions
                    ? "bg-shield-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                placeholder="Type a message..."
                className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-shield-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-3 rounded-xl bg-shield-500 text-white hover:bg-shield-600 disabled:opacity-50 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
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
            <h2 className="text-xl font-semibold text-white mb-2">
              Select a Mission
            </h2>
            <p className="text-zinc-500">Choose an event from the sidebar</p>
          </div>
        </div>
      )}
    </div>
  );
}
