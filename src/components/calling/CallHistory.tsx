"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase, useUser } from "@/hooks/useSupabase";
import { formatCallDuration } from "@/contexts/CallContext";
import type { Call } from "@/lib/database.types";

interface CallWithParticipant extends Call {
  otherParty?: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  direction: "incoming" | "outgoing";
}

export function CallHistory() {
  const supabase = useSupabase();
  const { user } = useUser();
  const [calls, setCalls] = useState<CallWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "incoming" | "outgoing" | "missed">("all");

  useEffect(() => {
    if (!user) return;
    loadCallHistory();
  }, [user]);

  const loadCallHistory = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .or(`caller_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Enrich calls with participant info
      const enrichedCalls: CallWithParticipant[] = await Promise.all(
        (data || []).map(async (call) => {
          const isOutgoing = call.caller_user_id === user.id;
          const otherUserId = isOutgoing ? call.receiver_user_id : call.caller_user_id;

          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url, role")
            .eq("id", otherUserId)
            .single();

          return {
            ...call,
            direction: isOutgoing ? "outgoing" : "incoming",
            otherParty: profile
              ? {
                  name: profile.display_name || "Unknown",
                  role: profile.role || "unknown",
                  avatarUrl: profile.avatar_url || undefined,
                }
              : undefined,
          } as CallWithParticipant;
        })
      );

      setCalls(enrichedCalls);
    } catch (error) {
      console.error("Error loading call history:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter((call) => {
    if (filter === "all") return true;
    if (filter === "incoming") return call.direction === "incoming";
    if (filter === "outgoing") return call.direction === "outgoing";
    if (filter === "missed") return call.status === "missed" || call.status === "declined";
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "ended":
        return "text-emerald-400";
      case "missed":
        return "text-red-400";
      case "declined":
        return "text-amber-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-zinc-400";
    }
  };

  const getStatusIcon = (status: string, direction: string) => {
    if (status === "missed") {
      return (
        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      );
    }
    if (direction === "outgoing") {
      return (
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  };

  const formatCallTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

    const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + `, ${time}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          className="w-8 h-8 border-2 border-shield-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Call History</h2>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {[
            { value: "all", label: "All" },
            { value: "incoming", label: "Incoming" },
            { value: "outgoing", label: "Outgoing" },
            { value: "missed", label: "Missed" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value as any)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                filter === option.value
                  ? "bg-shield-500 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Call list */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredCalls.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <p className="text-zinc-400">No calls yet</p>
              <p className="text-sm text-zinc-500 mt-1">Your call history will appear here</p>
            </motion.div>
          ) : (
            filteredCalls.map((call, index) => (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-xl p-4 flex items-center gap-4"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center">
                    {call.otherParty?.avatarUrl ? (
                      <img
                        src={call.otherParty.avatarUrl}
                        alt={call.otherParty.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-white">
                        {call.otherParty?.name?.[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1">
                    {getStatusIcon(call.status, call.direction)}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {call.otherParty?.name || "Unknown"}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500 capitalize">
                      {call.otherParty?.role || "User"}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className={getStatusColor(call.status)}>
                      {call.status === "ended" && call.duration_seconds
                        ? formatCallDuration(call.duration_seconds)
                        : call.status === "missed"
                        ? "Missed"
                        : call.status === "declined"
                        ? "Declined"
                        : call.status}
                    </span>
                  </div>
                </div>

                {/* Time */}
                <div className="text-right">
                  <p className="text-sm text-zinc-400">{formatCallTime(call.created_at)}</p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
