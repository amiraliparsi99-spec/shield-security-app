"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ShiftRating = {
  id: string;
  bookingId?: string;
  staffId: string;
  staffUserId?: string;
  staffName: string;
  staffAvatarUrl?: string | null;
  eventName: string;
  eventDate: string;
  role: string;
  rating: number;
  categories: {
    professionalism: number;
    punctuality: number;
    communication: number;
    effectiveness: number;
  };
  feedback?: string;
  wouldBookAgain: boolean;
};

type PendingRating = {
  id: string;
  bookingId: string;
  staffId: string;
  staffUserId?: string;
  staffName: string;
  staffAvatarUrl?: string | null;
  role: string;
  eventName: string;
  eventDate: string;
  avgRating: number;
  totalReviews: number;
  shieldScore: number;
  totalShifts: number;
  recentFeedback?: string;
};

type Identity = {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  shieldScore: number;
  totalShifts: number;
};

type Reputation = {
  avg: number;
  count: number;
  recentFeedback?: string;
};

type RankedStaff = {
  staffId: string;
  staffUserId?: string;
  name: string;
  avatarUrl: string | null;
  avgRating: number;
  totalReviews: number;
  totalShifts: number;
  shieldScore: number;
  recentFeedback?: string;
};

function shortDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function resolveIdentity(
  staffId: string,
  personnelById: Record<string, any>,
  profileByUserId: Record<string, any>,
): Identity {
  const person = personnelById[staffId];
  const profile = person?.user_id ? profileByUserId[person.user_id] : undefined;
  const profileName = profile?.display_name as string | undefined;
  const personName = person?.display_name as string | undefined;
  return {
    userId: (person?.user_id as string | null) ?? null,
    name: profileName || personName || "Security Staff",
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
    shieldScore: Number(person?.shield_score ?? 0),
    totalShifts: Number(person?.total_shifts ?? 0),
  };
}

function getRoleFromShift(rawRole: unknown): string {
  const role = String(rawRole || "").trim();
  return role || "Security";
}

async function resolveVenueId(supabase: any, userId: string): Promise<string | null> {
  const { data: byUser } = await supabase
    .from("venues")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (byUser?.id) return byUser.id;

  const { data: byOwner } = await supabase
    .from("venues")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return byOwner?.id ?? null;
}

async function resolveReviewerId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return profile?.id ?? userId;
}

export function StaffRatings() {
  const searchParams = useSearchParams();
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [pastRatings, setPastRatings] = useState<ShiftRating[]>([]);
  const [rankedStaff, setRankedStaff] = useState<RankedStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRating, setActiveRating] = useState<PendingRating | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [ratingForm, setRatingForm] = useState({
    professionalism: 0,
    punctuality: 0,
    communication: 0,
    effectiveness: 0,
    feedback: "",
    wouldBookAgain: true,
  });

  useEffect(() => {
    const fetch = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const reviewerId = await resolveReviewerId(supabase, user.id);
      const venueId = await resolveVenueId(supabase, user.id);
      if (!venueId) {
        setLoading(false);
        return;
      }

      const [{ data: reviewsData }, { data: venueBookings }, { data: topPersonnel }] = await Promise.all([
        supabase
          .from("reviews")
          .select(
            "id, booking_id, reviewee_id, overall_rating, professionalism_rating, punctuality_rating, communication_rating, content, created_at",
          )
          .in("reviewer_id", reviewerId === user.id ? [user.id] : [user.id, reviewerId])
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("bookings")
          .select("id, event_name, event_date")
          .eq("venue_id", venueId)
          .order("event_date", { ascending: false }),
        supabase
          .from("personnel")
          .select("id, user_id, display_name, shield_score, total_shifts")
          .eq("is_active", true)
          .order("total_shifts", { ascending: false })
          .limit(150),
      ]);

      const bookingMap: Record<string, { event_name: string; event_date: string }> = {};
      const bookingIds = (venueBookings || []).map((b: any) => b.id);
      (venueBookings || []).forEach((b: any) => {
        bookingMap[b.id] = {
          event_name: b.event_name || "Event",
          event_date: b.event_date || "",
        };
      });

      let shiftsData: any[] = [];
      if (bookingIds.length > 0) {
        const { data } = await supabase
          .from("shifts")
          .select("id, personnel_id, booking_id, role, status")
          .eq("status", "checked_out")
          .in("booking_id", bookingIds);
        shiftsData = data || [];
      }

      const allStaffIds = new Set<string>();
      (shiftsData || []).forEach((s: any) => s.personnel_id && allStaffIds.add(s.personnel_id));
      (reviewsData || []).forEach((r: any) => r.reviewee_id && allStaffIds.add(r.reviewee_id));
      (topPersonnel || []).forEach((p: any) => p.id && allStaffIds.add(p.id));

      let personnelRows: any[] = topPersonnel || [];
      const missingIds = Array.from(allStaffIds).filter(
        (id) => !(personnelRows || []).some((p: any) => p.id === id),
      );
      if (missingIds.length > 0) {
        const { data } = await supabase
          .from("personnel")
          .select("id, user_id, display_name, shield_score, total_shifts")
          .in("id", missingIds);
        personnelRows = [...personnelRows, ...(data || [])];
      }

      const personnelById: Record<string, any> = {};
      (personnelRows || []).forEach((p: any) => {
        personnelById[p.id] = p;
      });

      const userIds = (personnelRows || []).map((p: any) => p.user_id).filter(Boolean);
      const profileByUserId: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesById } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);
        (profilesById || []).forEach((p: any) => {
          profileByUserId[p.id] = p;
        });
      }

      const aggregateIds = Array.from(allStaffIds);
      let allReviewRows: any[] = [];
      if (aggregateIds.length > 0) {
        const { data } = await supabase
          .from("reviews")
          .select("reviewee_id, overall_rating, content, created_at")
          .in("reviewee_id", aggregateIds)
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(4000);
        allReviewRows = data || [];
      }

      const reputationById: Record<string, Reputation> = {};
      const running: Record<string, { sum: number; count: number; recentFeedback?: string }> = {};
      allReviewRows.forEach((r: any) => {
        const id = r.reviewee_id;
        if (!id) return;
        if (!running[id]) {
          running[id] = { sum: 0, count: 0, recentFeedback: r.content || undefined };
        }
        running[id].sum += Number(r.overall_rating ?? 0);
        running[id].count += 1;
      });
      Object.entries(running).forEach(([id, value]) => {
        reputationById[id] = {
          avg: value.count > 0 ? Math.round((value.sum / value.count) * 10) / 10 : 0,
          count: value.count,
          recentFeedback: value.recentFeedback,
        };
      });

      const reviewedBookingStaff = new Set(
        (reviewsData || [])
          .map((r: any) => (r.booking_id && r.reviewee_id ? `${r.booking_id}:${r.reviewee_id}` : null))
          .filter(Boolean),
      );
      const pending: PendingRating[] = [];
      (shiftsData || []).forEach((s: any) => {
        if (!s.personnel_id || !s.booking_id) return;
        const bookingStaffKey = `${s.booking_id}:${s.personnel_id}`;
        if (reviewedBookingStaff.has(bookingStaffKey)) return;
        const booking = bookingMap[s.booking_id];
        if (!booking) return;
        const identity = resolveIdentity(s.personnel_id, personnelById, profileByUserId);
        const rep = reputationById[s.personnel_id] || { avg: 0, count: 0 };
        pending.push({
          id: s.id,
          bookingId: s.booking_id,
          staffId: s.personnel_id,
          staffUserId: identity.userId ?? undefined,
          staffName: identity.name,
          staffAvatarUrl: identity.avatarUrl,
          role: getRoleFromShift(s.role),
          eventName: booking.event_name,
          eventDate: booking.event_date,
          avgRating: rep.avg,
          totalReviews: rep.count,
          shieldScore: identity.shieldScore,
          totalShifts: identity.totalShifts,
          recentFeedback: rep.recentFeedback,
        });
      });

      const roleByBookingStaff: Record<string, string> = {};
      (shiftsData || []).forEach((s: any) => {
        if (!s.booking_id || !s.personnel_id) return;
        const key = `${s.booking_id}:${s.personnel_id}`;
        if (!roleByBookingStaff[key]) roleByBookingStaff[key] = getRoleFromShift(s.role);
      });

      const past: ShiftRating[] = (reviewsData || []).map((r: any) => {
        const booking = r.booking_id ? bookingMap[r.booking_id] : null;
        const roleKey = r.booking_id && r.reviewee_id ? `${r.booking_id}:${r.reviewee_id}` : "";
        const identity = resolveIdentity(r.reviewee_id, personnelById, profileByUserId);
        return {
          id: r.id,
          bookingId: r.booking_id || undefined,
          staffId: r.reviewee_id,
          staffUserId: identity.userId ?? undefined,
          staffName: identity.name,
          staffAvatarUrl: identity.avatarUrl,
          eventName: booking?.event_name || "Shift",
          eventDate: booking?.event_date || r.created_at?.slice(0, 10) || "",
          role: roleByBookingStaff[roleKey] || "Security",
          rating: Number(r.overall_rating || 0),
          categories: {
            professionalism: Number(r.professionalism_rating ?? 0),
            punctuality: Number(r.punctuality_rating ?? 0),
            communication: Number(r.communication_rating ?? 0),
            effectiveness: Number(r.overall_rating ?? 0),
          },
          feedback: r.content ?? undefined,
          wouldBookAgain: Number(r.overall_rating || 0) >= 4,
        };
      });

      const ranking: RankedStaff[] = (topPersonnel || [])
        .map((p: any) => {
          const identity = resolveIdentity(p.id, personnelById, profileByUserId);
          const rep = reputationById[p.id];
          return {
            staffId: p.id,
            staffUserId: identity.userId ?? undefined,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
            avgRating: rep?.avg || 0,
            totalReviews: rep?.count || 0,
            totalShifts: Number(p.total_shifts || 0),
            shieldScore: Number(p.shield_score || 0),
            recentFeedback: rep?.recentFeedback,
          };
        })
        .filter((r) => r.totalReviews > 0)
        .sort((a, b) => {
          if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
          if (b.totalReviews !== a.totalReviews) return b.totalReviews - a.totalReviews;
          return b.totalShifts - a.totalShifts;
        })
        .slice(0, 10);

      setPendingRatings(pending);
      setPastRatings(past);
      setRankedStaff(ranking);
      setLoading(false);
    };
    fetch();
  }, []);

  useEffect(() => {
    if (loading || activeRating || pendingRatings.length === 0) return;
    const bookingId = searchParams.get("booking");
    const staffId = searchParams.get("staff");
    if (!bookingId || !staffId) return;

    const match = pendingRatings.find((p) => p.bookingId === bookingId && p.staffId === staffId);
    if (match) setActiveRating(match);
  }, [loading, activeRating, pendingRatings, searchParams]);

  const handleStarClick = (category: keyof typeof ratingForm, value: number) => {
    if (category === "feedback" || category === "wouldBookAgain") return;
    setRatingForm(prev => ({ ...prev, [category]: value }));
  };

  const calculateOverall = () => {
    const { professionalism, punctuality, communication, effectiveness } = ratingForm;
    if (!professionalism || !punctuality || !communication || !effectiveness) return 0;
    return Math.round((professionalism + punctuality + communication + effectiveness) / 4 * 10) / 10;
  };

  const submitRating = async () => {
    if (!activeRating || submitting) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError("You need to be signed in to submit a rating.");
      setSubmitting(false);
      return;
    }
    const overall = calculateOverall();
    const profileId = await resolveReviewerId(supabase, user.id);
    const candidateReviewerIds = profileId === user.id ? [user.id] : [user.id, profileId];
    let inserted: any = null;
    let lastError: any = null;

    for (const reviewerId of candidateReviewerIds) {
      const { data, error } = await supabase
        .from("reviews")
        .insert({
          booking_id: activeRating.bookingId,
          reviewer_id: reviewerId,
          reviewee_id: activeRating.staffId,
          reviewer_type: "venue",
          reviewee_type: "personnel",
          overall_rating: overall,
          professionalism_rating: ratingForm.professionalism,
          punctuality_rating: ratingForm.punctuality,
          communication_rating: ratingForm.communication,
          content: ratingForm.feedback || null,
          is_public: true,
        })
        .select("id, created_at")
        .single();

      if (!error && data) {
        inserted = data;
        lastError = null;
        break;
      }
      lastError = error;
    }

    if (!inserted) {
      const message = String(lastError?.message || "").toLowerCase();
      if (message.includes("duplicate") || message.includes("already")) {
        setSubmitError("This shift has already been reviewed from this account.");
      } else {
        setSubmitError(lastError?.message || "Could not submit rating. Please try again.");
      }
      setSubmitting(false);
      return;
    }
    const newRating: ShiftRating = {
      id: inserted?.id ?? String(Date.now()),
      bookingId: activeRating.bookingId,
      staffId: activeRating.staffId,
      staffUserId: activeRating.staffUserId,
      staffName: activeRating.staffName,
      staffAvatarUrl: activeRating.staffAvatarUrl,
      eventName: activeRating.eventName,
      eventDate: activeRating.eventDate,
      role: activeRating.role,
      rating: overall,
      categories: {
        professionalism: ratingForm.professionalism,
        punctuality: ratingForm.punctuality,
        communication: ratingForm.communication,
        effectiveness: ratingForm.effectiveness,
      },
      feedback: ratingForm.feedback,
      wouldBookAgain: ratingForm.wouldBookAgain,
    };
    setPastRatings(prev => [newRating, ...prev]);
    setPendingRatings(prev => prev.filter(p => p.id !== activeRating.id));
    setActiveRating(null);
    setRatingForm({
      professionalism: 0,
      punctuality: 0,
      communication: 0,
      effectiveness: 0,
      feedback: "",
      wouldBookAgain: true,
    });
    setSubmitSuccess("Rating submitted successfully.");
    setSubmitting(false);
  };

  const StarRating = ({ value, onChange, size = "normal" }: { value: number; onChange: (v: number) => void; size?: "normal" | "small" }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`transition ${size === "small" ? "text-lg" : "text-2xl"} ${
            star <= value ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );

  const DisplayStars = ({ value, size = "normal" }: { value: number; size?: "normal" | "small" }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={`${size === "small" ? "text-sm" : "text-lg"} ${
            star <= value ? "text-amber-400" : "text-zinc-700"
          }`}
        >
          ★
        </span>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const avgRating = pastRatings.length
    ? (pastRatings.reduce((sum, r) => sum + r.rating, 0) / pastRatings.length).toFixed(1)
    : "—";

  const hiresWithReviews = rankedStaff.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Staff Ratings</h2>
        <p className="text-sm text-zinc-400">
          Rate completed shifts and use network reputation to confidently rehire top security professionals.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Pending Ratings</p>
          <p className="text-2xl font-bold text-amber-400">{pendingRatings.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Ratings</p>
          <p className="text-2xl font-bold text-white">{pastRatings.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg Rating Given</p>
          <p className="text-2xl font-bold text-emerald-400">{avgRating}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Rated Talent Pool</p>
          <p className="text-2xl font-bold text-cyan-400">{hiresWithReviews}</p>
        </div>
      </div>

      {/* Pending Ratings */}
      {pendingRatings.length > 0 && !activeRating && (
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">⏳</span>
            <div>
              <h3 className="font-semibold text-white">Rate Recent Shifts</h3>
              <p className="text-sm text-zinc-400">{pendingRatings.length} staff awaiting feedback</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingRatings.map(pending => (
              <div
                key={pending.id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition cursor-pointer"
                onClick={() => setActiveRating(pending)}
              >
                <div className="flex items-center gap-3">
                  {pending.staffAvatarUrl ? (
                    <img
                      src={pending.staffAvatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-shield-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                      {pending.staffName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white">{pending.staffName}</p>
                    <p className="text-xs text-zinc-400">
                      {pending.role} • {pending.eventName} • {shortDate(pending.eventDate)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {pending.totalReviews > 0
                        ? `Reputation: ${pending.avgRating.toFixed(1)}★ (${pending.totalReviews})`
                        : "No public reviews yet"}{" "}
                      • Shield {pending.shieldScore}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pending.staffUserId && (
                    <Link
                      href={`/chat/start?with=${encodeURIComponent(pending.staffUserId)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 text-zinc-300 hover:text-white hover:bg-white/15 transition"
                    >
                      Message
                    </Link>
                  )}
                  <motion.button
                    className="bg-shield-500 hover:bg-shield-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Rate Now
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating Form */}
      {activeRating && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {activeRating.staffAvatarUrl ? (
                <img
                  src={activeRating.staffAvatarUrl}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-shield-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold">
                  {activeRating.staffName.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-white">{activeRating.staffName}</h3>
                <p className="text-sm text-zinc-400">{activeRating.role} • {activeRating.eventName}</p>
                <p className="text-xs text-zinc-500">
                  {activeRating.totalReviews > 0
                    ? `${activeRating.avgRating.toFixed(1)}★ across ${activeRating.totalReviews} venue reviews`
                    : "No public reviews yet"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveRating(null)}
              className="text-zinc-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Rating Categories */}
          <div className="space-y-4 mb-6">
            {[
              { key: "professionalism", label: "Professionalism", desc: "Appearance, conduct, attitude" },
              { key: "punctuality", label: "Punctuality", desc: "Arrived on time, stayed full shift" },
              { key: "communication", label: "Communication", desc: "Clear, responsive, reported issues" },
              { key: "effectiveness", label: "Effectiveness", desc: "Handled situations well" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                <div>
                  <p className="font-medium text-white">{label}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
                <StarRating
                  value={ratingForm[key as keyof typeof ratingForm] as number}
                  onChange={(v) => handleStarClick(key as keyof typeof ratingForm, v)}
                />
              </div>
            ))}
          </div>

          {/* Overall Score */}
          {calculateOverall() > 0 && (
            <div className="bg-white/5 rounded-lg p-4 mb-6 text-center">
              <p className="text-sm text-zinc-400 mb-1">Overall Rating</p>
              <p className="text-4xl font-bold text-amber-400">{calculateOverall()}</p>
              <DisplayStars value={Math.round(calculateOverall())} />
            </div>
          )}

          {/* Feedback */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-400 mb-2">Feedback (Optional)</label>
            <textarea
              value={ratingForm.feedback}
              onChange={(e) => setRatingForm(prev => ({ ...prev, feedback: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition h-24 resize-none"
              placeholder="Any additional feedback about this staff member..."
            />
          </div>

          {/* Would Book Again */}
          <div className="flex items-center gap-4 mb-6">
            <p className="text-white">Would you book this person again?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRatingForm(prev => ({ ...prev, wouldBookAgain: true }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  ratingForm.wouldBookAgain
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                👍 Yes
              </button>
              <button
                onClick={() => setRatingForm(prev => ({ ...prev, wouldBookAgain: false }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  !ratingForm.wouldBookAgain
                    ? "bg-red-500 text-white"
                    : "bg-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                👎 No
              </button>
            </div>
          </div>

          {/* Submit */}
          {(submitError || submitSuccess) && (
            <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
              submitError
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}>
              {submitError || submitSuccess}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setActiveRating(null);
                setSubmitError(null);
                setSubmitSuccess(null);
              }}
              className="px-4 py-2 text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <motion.button
              onClick={submitRating}
              disabled={calculateOverall() === 0 || submitting}
              className="bg-shield-500 hover:bg-shield-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium transition"
              whileHover={{ scale: calculateOverall() > 0 ? 1.02 : 1 }}
              whileTap={{ scale: calculateOverall() > 0 ? 0.98 : 1 }}
            >
              {submitting ? "Submitting..." : "Submit Rating"}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Network Reputation */}
      <div className="glass rounded-xl p-4 border border-cyan-500/20 bg-cyan-500/[0.03]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Top Rated Security Across Shield HQ</h3>
            <p className="text-xs text-zinc-400">Shared venue reputation helps every venue hire with confidence.</p>
          </div>
        </div>
        {rankedStaff.length === 0 ? (
          <p className="text-sm text-zinc-500">No ranked profiles yet.</p>
        ) : (
          <div className="space-y-2">
            {rankedStaff.map((staff, idx) => (
              <div key={staff.staffId} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-zinc-500 w-5">{idx + 1}.</span>
                    {staff.avatarUrl ? (
                      <img src={staff.avatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center font-semibold">
                        {staff.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{staff.name}</p>
                      <p className="text-xs text-zinc-400">
                        {staff.avgRating.toFixed(1)}★ • {staff.totalReviews} reviews • {staff.totalShifts} shifts • Shield {staff.shieldScore}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {staff.staffUserId && (
                      <Link
                        href={`/chat/start?with=${encodeURIComponent(staff.staffUserId)}`}
                        className="text-xs px-2 py-1 rounded-md bg-white/10 text-zinc-300 hover:text-white hover:bg-white/15 transition"
                      >
                        Message
                      </Link>
                    )}
                    <Link
                      href={`/d/venue/personnel/${staff.staffId}`}
                      className="text-xs px-2 py-1 rounded-md bg-white/10 text-zinc-300 hover:text-white hover:bg-white/15 transition"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
                {staff.recentFeedback && (
                  <p className="mt-2 text-xs text-zinc-500 italic">"{staff.recentFeedback}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Ratings */}
      <div>
        <h3 className="font-semibold text-white mb-4">Rating History</h3>
        <div className="space-y-3">
          {pastRatings.map(rating => (
            <div key={rating.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {rating.staffAvatarUrl ? (
                    <img src={rating.staffAvatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10" />
                  ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                      rating.wouldBookAgain
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                        : "bg-gradient-to-br from-red-500 to-red-600"
                    }`}>
                      {rating.staffName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white">{rating.staffName}</p>
                    <p className="text-xs text-zinc-400">
                      {rating.role} • {rating.eventName} • {new Date(rating.eventDate).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">{rating.rating}</span>
                    <DisplayStars value={Math.round(rating.rating)} size="small" />
                  </div>
                  <span className={`text-xs ${rating.wouldBookAgain ? "text-emerald-400" : "text-red-400"}`}>
                    {rating.wouldBookAgain ? "✓ Would book again" : "✗ Would not book"}
                  </span>
                </div>
              </div>
              {rating.feedback && (
                <p className="mt-3 text-sm text-zinc-400 italic">"{rating.feedback}"</p>
              )}
              <div className="mt-3">
                <div className="flex items-center gap-4">
                  {rating.staffUserId && (
                    <Link
                      href={`/chat/start?with=${encodeURIComponent(rating.staffUserId)}`}
                      className="text-xs text-zinc-300 hover:text-white transition"
                    >
                      Message staff
                    </Link>
                  )}
                  <Link
                    href={`/d/venue/personnel/${rating.staffId}`}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Open staff profile →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
