"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type ShiftRating = {
  id: string;
  staffId: string;
  staffName: string;
  eventName: string;
  eventDate: string;
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
  staffId: string;
  staffName: string;
  role: string;
  eventName: string;
  eventDate: string;
};

const mockPendingRatings: PendingRating[] = [
  { id: "p1", staffId: "1", staffName: "Marcus Johnson", role: "Door Security", eventName: "Friday Night", eventDate: "2026-01-26" },
  { id: "p2", staffId: "2", staffName: "Sarah Williams", role: "Floor Security", eventName: "Friday Night", eventDate: "2026-01-26" },
  { id: "p3", staffId: "3", staffName: "Lisa Brown", role: "Door Security", eventName: "Friday Night", eventDate: "2026-01-26" },
];

const mockPastRatings: ShiftRating[] = [
  {
    id: "r1",
    staffId: "1",
    staffName: "Marcus Johnson",
    eventName: "Thursday Event",
    eventDate: "2026-01-25",
    rating: 5,
    categories: { professionalism: 5, punctuality: 5, communication: 5, effectiveness: 5 },
    feedback: "Excellent as always. Handled a difficult situation perfectly.",
    wouldBookAgain: true,
  },
  {
    id: "r2",
    staffId: "4",
    staffName: "Emma Thompson",
    eventName: "VIP Night",
    eventDate: "2026-01-24",
    rating: 5,
    categories: { professionalism: 5, punctuality: 5, communication: 4, effectiveness: 5 },
    feedback: "Great with VIP guests.",
    wouldBookAgain: true,
  },
  {
    id: "r3",
    staffId: "5",
    staffName: "James Wilson",
    eventName: "Friday Night",
    eventDate: "2026-01-19",
    rating: 2,
    categories: { professionalism: 2, punctuality: 1, communication: 3, effectiveness: 2 },
    feedback: "Late arrival, unprofessional conduct. Do not book again.",
    wouldBookAgain: false,
  },
];

export function StaffRatings() {
  const [pendingRatings] = useState<PendingRating[]>(mockPendingRatings);
  const [pastRatings, setPastRatings] = useState<ShiftRating[]>(mockPastRatings);
  const [activeRating, setActiveRating] = useState<PendingRating | null>(null);
  const [ratingForm, setRatingForm] = useState({
    professionalism: 0,
    punctuality: 0,
    communication: 0,
    effectiveness: 0,
    feedback: "",
    wouldBookAgain: true,
  });

  const handleStarClick = (category: keyof typeof ratingForm, value: number) => {
    if (category === "feedback" || category === "wouldBookAgain") return;
    setRatingForm(prev => ({ ...prev, [category]: value }));
  };

  const calculateOverall = () => {
    const { professionalism, punctuality, communication, effectiveness } = ratingForm;
    if (!professionalism || !punctuality || !communication || !effectiveness) return 0;
    return Math.round((professionalism + punctuality + communication + effectiveness) / 4 * 10) / 10;
  };

  const submitRating = () => {
    if (!activeRating) return;
    
    const newRating: ShiftRating = {
      id: String(Date.now()),
      staffId: activeRating.staffId,
      staffName: activeRating.staffName,
      eventName: activeRating.eventName,
      eventDate: activeRating.eventDate,
      rating: calculateOverall(),
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
    setActiveRating(null);
    setRatingForm({
      professionalism: 0,
      punctuality: 0,
      communication: 0,
      effectiveness: 0,
      feedback: "",
      wouldBookAgain: true,
    });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Staff Ratings</h2>
        <p className="text-sm text-zinc-400">Rate staff performance after each shift</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
          <p className="text-2xl font-bold text-emerald-400">
            {(pastRatings.reduce((sum, r) => sum + r.rating, 0) / pastRatings.length).toFixed(1)}
          </p>
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
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-shield-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {pending.staffName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{pending.staffName}</p>
                    <p className="text-xs text-zinc-400">{pending.role} • {pending.eventName}</p>
                  </div>
                </div>
                <motion.button
                  className="bg-shield-500 hover:bg-shield-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Rate Now
                </motion.button>
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-shield-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold">
                {activeRating.staffName.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{activeRating.staffName}</h3>
                <p className="text-sm text-zinc-400">{activeRating.role} • {activeRating.eventName}</p>
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
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setActiveRating(null)}
              className="px-4 py-2 text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <motion.button
              onClick={submitRating}
              disabled={calculateOverall() === 0}
              className="bg-shield-500 hover:bg-shield-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium transition"
              whileHover={{ scale: calculateOverall() > 0 ? 1.02 : 1 }}
              whileTap={{ scale: calculateOverall() > 0 ? 0.98 : 1 }}
            >
              Submit Rating
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Past Ratings */}
      <div>
        <h3 className="font-semibold text-white mb-4">Rating History</h3>
        <div className="space-y-3">
          {pastRatings.map(rating => (
            <div key={rating.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                    rating.wouldBookAgain
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                      : "bg-gradient-to-br from-red-500 to-red-600"
                  }`}>
                    {rating.staffName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{rating.staffName}</p>
                    <p className="text-xs text-zinc-400">
                      {rating.eventName} • {new Date(rating.eventDate).toLocaleDateString("en-GB")}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
