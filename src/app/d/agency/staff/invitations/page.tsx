"use client";

import { useState, useEffect } from "react";
import { useSupabase, useUser } from "@/hooks/useSupabase";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface PendingInvitation {
  id: string;
  personnel_id: string;
  role: string;
  hourly_rate: number | null;
  message: string | null;
  created_at: string;
  expires_at: string;
  personnel: {
    display_name: string;
    city: string | null;
    skills: string[] | null;
  };
}

export default function PendingInvitationsPage() {
  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading) {
      if (user) {
        loadInvitations();
        subscribeToInvitations();
      } else {
        setIsLoading(false);
      }
    }
  }, [user, userLoading]);

  const loadInvitations = async () => {
    console.log("loadInvitations called", { user: !!user, userId: user?.id });
    
    if (!supabase || !user) {
      console.log("No supabase or user");
      setIsLoading(false);
      return;
    }

    try {
      // Get agency (user.id is the profile id)
      console.log("Fetching agency for user:", user.id);
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      console.log("Agency result:", { agency, agencyError });

      if (agencyError || !agency) {
        console.log("No agency found for user:", user.id);
        setIsLoading(false);
        return;
      }

      // Get pending invitations
      console.log("Fetching invitations for agency:", agency.id);
      const { data, error } = await supabase
        .from("agency_invitations")
        .select(`
          *,
          personnel (
            display_name,
            city,
            skills
          )
        `)
        .eq("agency_id", agency.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      console.log("Invitations result:", { data, error, count: data?.length });

      if (error) {
        console.error("Error fetching invitations:", error);
      }

      setInvitations(data || []);
    } catch (error) {
      console.error("Error loading invitations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToInvitations = () => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel("agency-invitations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agency_invitations",
        },
        () => {
          loadInvitations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleCancel = async (invitationId: string) => {
    if (!supabase) return;

    const confirmed = confirm(
      "Are you sure you want to cancel this invitation?"
    );

    if (!confirmed) return;

    setCancellingId(invitationId);

    try {
      const { error } = await supabase
        .from("agency_invitations")
        .delete()
        .eq("id", invitationId);

      if (error) throw error;

      // Remove from list
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } catch (error: any) {
      console.error("Cancel error:", error);
      alert(error.message || "Failed to cancel invitation");
    } finally {
      setCancellingId(null);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} remaining`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} remaining`;
    } else {
      return "Expiring soon";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Pending Invitations
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track invitations sent to security personnel
          </p>
        </div>
        <Link
          href="/d/agency/staff/add"
          className="rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400"
        >
          + Send Invitation
        </Link>
      </div>

      {/* Stats */}
      {invitations.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="glass rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Total Pending
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-white">
              {invitations.length}
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Expiring Soon
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-white">
              {
                invitations.filter((inv) => {
                  const diff =
                    new Date(inv.expires_at).getTime() - new Date().getTime();
                  return diff < 24 * 60 * 60 * 1000; // Less than 24 hours
                }).length
              }
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              This Week
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-white">
              {
                invitations.filter((inv) => {
                  const diff =
                    new Date().getTime() - new Date(inv.created_at).getTime();
                  return diff < 7 * 24 * 60 * 60 * 1000;
                }).length
              }
            </p>
          </div>
        </div>
      )}

      {/* Invitations List */}
      {invitations.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <svg
              className="h-8 w-8 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="mt-4 font-display text-lg font-medium text-white">
            No Pending Invitations
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Send invitations to security personnel to build your team
          </p>
          <Link
            href="/d/agency/staff/add"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400"
          >
            <svg
              className="h-4 w-4"
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
            Send First Invitation
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {invitations.map((invitation) => (
              <motion.div
                key={invitation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass rounded-2xl p-6"
              >
                <div className="flex items-start justify-between">
                  {/* Personnel Info */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-sm font-semibold text-white">
                      {invitation.personnel.display_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-medium text-white">
                        {invitation.personnel.display_name}
                      </h3>
                      {invitation.personnel.city && (
                        <p className="mt-0.5 text-sm text-zinc-400">
                          {invitation.personnel.city}
                        </p>
                      )}
                      {invitation.personnel.skills &&
                        invitation.personnel.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {invitation.personnel.skills.slice(0, 3).map((skill) => (
                              <span
                                key={skill}
                                className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
                    {formatTimeRemaining(invitation.expires_at)}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="mt-4 grid gap-4 border-t border-white/5 pt-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Role
                    </p>
                    <p className="mt-1 text-sm font-medium capitalize text-white">
                      {invitation.role}
                    </p>
                  </div>
                  {invitation.hourly_rate && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Hourly Rate
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        £{(invitation.hourly_rate / 100).toFixed(2)}/hr
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Sent
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {formatDate(invitation.created_at)}
                    </p>
                  </div>
                </div>

                {/* Message */}
                {invitation.message && (
                  <div className="mt-4 rounded-xl bg-white/[0.02] p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Your Message
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                      {invitation.message}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleCancel(invitation.id)}
                    disabled={cancellingId === invitation.id}
                    className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {cancellingId === invitation.id ? "Cancelling..." : "Cancel Invitation"}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
