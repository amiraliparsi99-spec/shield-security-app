"use client";

import { useState, useEffect } from "react";
import { useSupabase, useUser } from "@/hooks/useSupabase";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface AgencyInvitation {
  id: string;
  agency_id: string;
  role: string;
  hourly_rate: number | null;
  message: string | null;
  created_at: string;
  expires_at: string;
  agencies: {
    name: string;
    city: string | null;
  };
}

export default function InvitationsPage() {
  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [invitations, setInvitations] = useState<AgencyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      // Get personnel ID
      console.log("Fetching personnel for user:", user.id);
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", user.id)
        .single();

      console.log("Personnel result:", { personnel, personnelError });

      if (personnelError || !personnel) {
        console.log("No personnel found for user:", user.id);
        setIsLoading(false);
        return;
      }

      // Get pending invitations
      console.log("Fetching invitations for personnel:", personnel.id);
      const { data, error } = await supabase
        .from("agency_invitations")
        .select(`
          *,
          agencies (
            name,
            city
          )
        `)
        .eq("personnel_id", personnel.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
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
      .channel("personnel-invitations")
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

  const handleAccept = async (invitationId: string) => {
    if (!supabase) return;

    setProcessingId(invitationId);

    try {
      const { data, error } = await supabase.rpc("accept_agency_invitation", {
        invitation_id: invitationId,
      });

      if (error) throw error;

      if (data?.success) {
        // Remove from list
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
        
        // Show success message
        alert("Invitation accepted! You are now part of the agency.");
      } else {
        throw new Error(data?.error || "Failed to accept invitation");
      }
    } catch (error: any) {
      console.error("Accept error:", error);
      alert(error.message || "Failed to accept invitation");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    if (!supabase) return;

    const confirmed = confirm(
      "Are you sure you want to decline this invitation? This action cannot be undone."
    );

    if (!confirmed) return;

    setProcessingId(invitationId);

    try {
      const { error } = await supabase
        .from("agency_invitations")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (error) throw error;

      // Remove from list
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } catch (error: any) {
      console.error("Decline error:", error);
      alert(error.message || "Failed to decline invitation");
    } finally {
      setProcessingId(null);
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
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-white">
          Agency Invitations
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Review and respond to invitations from security agencies
        </p>
      </div>

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
            When agencies invite you to join their team, they&apos;ll appear here
          </p>
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
                {/* Agency Info */}
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-white">
                      {invitation.agencies.name}
                    </h3>
                    {invitation.agencies.city && (
                      <p className="mt-1 text-sm text-zinc-400">
                        {invitation.agencies.city}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-shield-500/20 px-3 py-1 text-xs font-medium text-shield-400">
                    {formatTimeRemaining(invitation.expires_at)}
                  </div>
                </div>

                {/* Role & Rate */}
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
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
                </div>

                {/* Message */}
                {invitation.message && (
                  <div className="mb-6 rounded-xl bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Message from Agency
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                      {invitation.message}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDecline(invitation.id)}
                    disabled={processingId === invitation.id}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleAccept(invitation.id)}
                    disabled={processingId === invitation.id}
                    className="flex-1 rounded-xl bg-shield-500 px-4 py-3 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400 disabled:opacity-50"
                  >
                    {processingId === invitation.id ? (
                      <span className="inline-flex items-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Accept & Join"
                    )}
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
