"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Badge = {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedDate?: string;
  locked: boolean;
};

type Review = {
  id: string;
  venueName: string;
  rating: number;
  comment: string;
  date: string;
  categories: {
    professionalism: number;
    punctuality: number;
    communication: number;
    effectiveness: number;
  };
};

type ScoreBreakdown = {
  category: string;
  score: number;
  weight: number;
  description: string;
};

const mockBadges: Badge[] = [
  { id: "1", name: "SIA Verified", icon: "🛡️", description: "SIA license verified", earnedDate: "2026-01-15", locked: false },
  { id: "2", name: "100 Shifts", icon: "💯", description: "Completed 100+ shifts", earnedDate: "2026-01-10", locked: false },
  { id: "3", name: "5-Star Performer", icon: "⭐", description: "Received 10+ five-star reviews", earnedDate: "2025-12-20", locked: false },
  { id: "4", name: "Early Bird", icon: "🌅", description: "Always arrives early", earnedDate: "2025-11-15", locked: false },
  { id: "5", name: "Night Owl", icon: "🦉", description: "50+ night shifts completed", earnedDate: "2025-10-01", locked: false },
  { id: "6", name: "Team Player", icon: "🤝", description: "10+ endorsements from colleagues", locked: true },
  { id: "7", name: "VIP Specialist", icon: "👑", description: "20+ VIP events", locked: true },
  { id: "8", name: "First Aider", icon: "🏥", description: "First aid certified", locked: true },
];

const mockReviews: Review[] = [
  {
    id: "1",
    venueName: "The Grand Club",
    rating: 5,
    comment: "Excellent professional. Handled a difficult situation perfectly. Would definitely book again.",
    date: "2026-01-26",
    categories: { professionalism: 5, punctuality: 5, communication: 5, effectiveness: 5 },
  },
  {
    id: "2",
    venueName: "Birmingham Arena",
    rating: 5,
    comment: "Great crowd management skills. Very calm under pressure.",
    date: "2026-01-18",
    categories: { professionalism: 5, punctuality: 5, communication: 4, effectiveness: 5 },
  },
  {
    id: "3",
    venueName: "Pryzm",
    rating: 4,
    comment: "Good overall performance. Reliable and professional.",
    date: "2026-01-12",
    categories: { professionalism: 4, punctuality: 5, communication: 4, effectiveness: 4 },
  },
];

const scoreBreakdown: ScoreBreakdown[] = [
  { category: "Reliability", score: 98, weight: 30, description: "Check-ins, no-shows, cancellations" },
  { category: "Reviews", score: 4.8, weight: 25, description: "Average venue rating" },
  { category: "Experience", score: 85, weight: 20, description: "Shifts completed, years active" },
  { category: "Verification", score: 100, weight: 15, description: "SIA, DBS, documents" },
  { category: "Response Time", score: 92, weight: 10, description: "How quickly you respond to offers" },
];

export function ShieldScore() {
  const [badges] = useState<Badge[]>(mockBadges);
  const [reviews] = useState<Review[]>(mockReviews);

  const overallScore = 94; // Calculated score
  const reviewCount = reviews.length;
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const earnedBadges = badges.filter(b => !b.locked).length;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-blue-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 95) return "Elite";
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Great";
    if (score >= 70) return "Good";
    return "Building";
  };

  const DisplayStars = ({ value }: { value: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star} className={`text-sm ${star <= value ? "text-amber-400" : "text-zinc-700"}`}>
          ★
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Shield Score</h2>
        <p className="text-sm text-zinc-400">Your reputation and achievements</p>
      </div>

      {/* Main Score Card */}
      <div className="glass rounded-xl p-6 text-center">
        <div className="relative inline-block mb-4">
          <svg className="w-40 h-40" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
            />
            {/* Score circle */}
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${overallScore * 2.83} 283`}
              transform="rotate(-90 50 50)"
              initial={{ strokeDasharray: "0 283" }}
              animate={{ strokeDasharray: `${overallScore * 2.83} 283` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</span>
            <span className="text-sm text-zinc-400">{getScoreLabel(overallScore)}</span>
          </div>
        </div>

        <div className="flex justify-center gap-8">
          <div>
            <p className="text-2xl font-bold text-white">{avgRating.toFixed(1)}</p>
            <p className="text-xs text-zinc-400">Avg Rating</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{reviewCount}</p>
            <p className="text-xs text-zinc-400">Reviews</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{earnedBadges}</p>
            <p className="text-xs text-zinc-400">Badges</p>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Score Breakdown</h3>
        <div className="space-y-4">
          {scoreBreakdown.map(item => (
            <div key={item.category}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-white font-medium">{item.category}</span>
                  <span className="text-xs text-zinc-500 ml-2">({item.weight}% weight)</span>
                </div>
                <span className={`font-bold ${getScoreColor(item.score)}`}>
                  {item.category === "Reviews" ? item.score.toFixed(1) : item.score}
                  {item.category === "Reviews" ? "/5" : "%"}
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.category === "Reviews" ? (item.score / 5) * 100 : item.score}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-shield-500 to-emerald-500 rounded-full"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Badges & Achievements</h3>
        <div className="grid grid-cols-4 gap-4">
          {badges.map(badge => (
            <motion.div
              key={badge.id}
              className={`text-center p-3 rounded-xl transition ${
                badge.locked
                  ? "bg-white/5 opacity-50"
                  : "bg-gradient-to-br from-shield-500/20 to-emerald-500/20 border border-shield-500/30"
              }`}
              whileHover={!badge.locked ? { scale: 1.05 } : {}}
            >
              <div className={`text-3xl mb-2 ${badge.locked ? "grayscale" : ""}`}>
                {badge.icon}
              </div>
              <p className="text-xs font-medium text-white">{badge.name}</p>
              {badge.locked ? (
                <p className="text-[10px] text-zinc-500 mt-1">🔒 Locked</p>
              ) : (
                <p className="text-[10px] text-emerald-400 mt-1">✓ Earned</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Recent Reviews</h3>
        <div className="space-y-4">
          {reviews.map(review => (
            <div key={review.id} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-white">{review.venueName}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(review.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{review.rating}</span>
                  <DisplayStars value={review.rating} />
                </div>
              </div>
              <p className="text-sm text-zinc-300 mb-3">"{review.comment}"</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(review.categories).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <p className="text-xs text-zinc-500 capitalize">{key}</p>
                    <p className="text-sm font-medium text-white">{value}/5</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips to Improve */}
      <div className="glass rounded-xl p-4 border border-shield-500/30 bg-shield-500/5">
        <h3 className="font-semibold text-white mb-2">💡 Tips to Boost Your Score</h3>
        <ul className="text-sm text-zinc-400 space-y-1">
          <li>• Always check in on time using GPS verification</li>
          <li>• Respond to shift offers within 2 hours</li>
          <li>• Complete your profile and upload all documents</li>
          <li>• Ask colleagues for endorsements</li>
        </ul>
      </div>
    </div>
  );
}
