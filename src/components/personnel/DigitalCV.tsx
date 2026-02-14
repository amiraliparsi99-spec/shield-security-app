"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Types
interface VenueExperience {
  venue_id: string;
  venue_name: string;
  venue_logo?: string;
  venue_type: string;
  shifts_completed: number;
  hours_worked: number;
  first_shift: string;
  last_shift: string;
  average_rating: number;
  verified: boolean; // GPS verified
  notable_events?: string[]; // e.g., "New Year's Eve 2024", "UEFA Final"
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  issued_date: string;
  expiry_date?: string;
  verified: boolean;
  badge_url?: string;
}

interface TrainingModule {
  id: string;
  name: string;
  category: string;
  completed_date: string;
  score: number;
  badge?: string;
}

interface ShieldTier {
  tier: "bronze" | "silver" | "gold" | "elite";
  points: number;
  next_tier_points: number;
  benefits: string[];
}

interface DigitalCVProps {
  personnelId: string;
  name: string;
  photo?: string;
  sia_number: string;
  sia_verified: boolean;
  member_since: string;
  tier: ShieldTier;
  total_shifts: number;
  total_hours: number;
  overall_rating: number;
  venues: VenueExperience[];
  certifications: Certification[];
  training: TrainingModule[];
  specializations: string[];
}

const TIER_CONFIG = {
  bronze: {
    label: "Bronze",
    color: "from-amber-700 to-amber-600",
    textColor: "text-amber-500",
    bgColor: "bg-amber-500/20",
    icon: "🥉",
    minShifts: 0,
  },
  silver: {
    label: "Silver",
    color: "from-slate-400 to-slate-300",
    textColor: "text-slate-300",
    bgColor: "bg-slate-400/20",
    icon: "🥈",
    minShifts: 25,
  },
  gold: {
    label: "Gold",
    color: "from-yellow-500 to-yellow-400",
    textColor: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    icon: "🥇",
    minShifts: 100,
  },
  elite: {
    label: "Shield Elite",
    color: "from-purple-600 to-blue-500",
    textColor: "text-purple-400",
    bgColor: "bg-purple-500/20",
    icon: "⭐",
    minShifts: 250,
  },
};

export function DigitalCV({
  personnelId,
  name,
  photo,
  sia_number,
  sia_verified,
  member_since,
  tier,
  total_shifts,
  total_hours,
  overall_rating,
  venues,
  certifications,
  training,
  specializations,
}: DigitalCVProps) {
  const [activeTab, setActiveTab] = useState<"experience" | "training" | "certifications">("experience");
  const [selectedVenue, setSelectedVenue] = useState<VenueExperience | null>(null);
  const tierConfig = TIER_CONFIG[tier.tier];

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        {/* Tier Banner */}
        <div className={`h-2 bg-gradient-to-r ${tierConfig.color}`} />
        
        <div className="p-6">
          <div className="flex items-start gap-6">
            {/* Profile Photo */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center overflow-hidden">
                {photo ? (
                  <img src={photo} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">👤</span>
                )}
              </div>
              {/* Tier Badge */}
              <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full ${tierConfig.bgColor} flex items-center justify-center text-lg border-2 border-zinc-900`}>
                {tierConfig.icon}
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-semibold text-white">{name}</h1>
                {sia_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-xs text-green-400 font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    SIA Verified
                  </span>
                )}
              </div>
              
              <p className="text-zinc-400 text-sm mb-3">
                SIA License: {sia_number} • Member since {formatDate(member_since)}
              </p>

              {/* Tier Progress */}
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${tierConfig.textColor}`}>
                  {tierConfig.icon} {tierConfig.label}
                </span>
                {tier.tier !== "elite" && (
                  <div className="flex-1 max-w-xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>{tier.points} pts</span>
                      <span>{tier.next_tier_points} pts</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${tierConfig.color} rounded-full transition-all`}
                        style={{ width: `${(tier.points / tier.next_tier_points) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{total_shifts}</p>
                <p className="text-xs text-zinc-500">Shifts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{total_hours.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Hours</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white flex items-center gap-1">
                  {overall_rating.toFixed(1)}
                  <span className="text-yellow-400 text-lg">★</span>
                </p>
                <p className="text-xs text-zinc-500">Rating</p>
              </div>
            </div>
          </div>

          {/* Specializations */}
          <div className="mt-4 flex flex-wrap gap-2">
            {specializations.map((spec) => (
              <span key={spec} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300">
                {spec}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
        {[
          { id: "experience", label: "Work History", icon: "🏢" },
          { id: "training", label: "Training Passport", icon: "🎓" },
          { id: "certifications", label: "Certifications", icon: "📜" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* Work History */}
        {activeTab === "experience" && (
          <motion.div
            key="experience"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Verified Work History</h2>
              <span className="text-xs text-zinc-500">
                <span className="text-green-400">●</span> GPS Verified
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {venues.map((venue) => (
                <button
                  key={venue.venue_id}
                  onClick={() => setSelectedVenue(venue)}
                  className="glass p-4 rounded-xl border border-white/10 text-left hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                      {venue.venue_logo ? (
                        <img src={venue.venue_logo} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <span className="text-2xl">🏢</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-white truncate">{venue.venue_name}</h3>
                        {venue.verified && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mb-2">{venue.venue_type}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-white font-semibold">{venue.shifts_completed} shifts</span>
                        <span className="text-zinc-500">{venue.hours_worked}h</span>
                        <span className="text-yellow-400">★ {venue.average_rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
                  </div>
                  
                  {venue.notable_events && venue.notable_events.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex flex-wrap gap-1.5">
                        {venue.notable_events.slice(0, 3).map((event) => (
                          <span key={event} className="px-2 py-0.5 rounded bg-purple-500/20 text-xs text-purple-300">
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Verification Note */}
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <span className="text-xl">📍</span>
                <div>
                  <p className="text-sm font-medium text-green-400 mb-1">GPS Verification</p>
                  <p className="text-xs text-zinc-400">
                    All shifts are verified using GPS check-in/check-out. This ensures venues can trust 
                    your work history is accurate and complete.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Training Passport */}
        {activeTab === "training" && (
          <motion.div
            key="training"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Training Passport</h2>
              <span className="text-xs text-zinc-500">{training.length} modules completed</span>
            </div>

            {/* Training Categories */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {training.map((module) => (
                <div
                  key={module.id}
                  className="glass p-4 rounded-xl border border-white/10"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{module.badge || "📚"}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      module.score >= 90 
                        ? "bg-green-500/20 text-green-400" 
                        : module.score >= 70 
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {module.score}%
                    </span>
                  </div>
                  <h3 className="font-medium text-white mb-1">{module.name}</h3>
                  <p className="text-xs text-zinc-500 mb-2">{module.category}</p>
                  <p className="text-xs text-zinc-600">Completed {formatDate(module.completed_date)}</p>
                </div>
              ))}
            </div>

            {/* Available Training CTA */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-center">
              <span className="text-3xl mb-3 block">🎓</span>
              <h3 className="text-lg font-semibold text-white mb-2">Unlock Shield Elite</h3>
              <p className="text-sm text-zinc-400 mb-4 max-w-md mx-auto">
                Complete more training modules to earn higher pay rates and priority access to premium shifts.
              </p>
              <button className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors">
                Browse Training →
              </button>
            </div>
          </motion.div>
        )}

        {/* Certifications */}
        {activeTab === "certifications" && (
          <motion.div
            key="certifications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Certifications & Licenses</h2>
            </div>

            <div className="space-y-3">
              {certifications.map((cert) => {
                const isExpired = cert.expiry_date && new Date(cert.expiry_date) < new Date();
                const isExpiringSoon = cert.expiry_date && 
                  new Date(cert.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                return (
                  <div
                    key={cert.id}
                    className={`glass p-4 rounded-xl border transition-all ${
                      isExpired 
                        ? "border-red-500/30 bg-red-500/5" 
                        : isExpiringSoon 
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                        <span className="text-2xl">📜</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{cert.name}</h3>
                          {cert.verified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-xs text-green-400">
                              ✓ Verified
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/20 text-xs text-red-400">
                              Expired
                            </span>
                          )}
                          {!isExpired && isExpiringSoon && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/20 text-xs text-amber-400">
                              Expiring Soon
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500">{cert.issuer}</p>
                        <p className="text-xs text-zinc-600 mt-1">
                          Issued: {formatDate(cert.issued_date)}
                          {cert.expiry_date && ` • Expires: ${formatDate(cert.expiry_date)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Certification CTA */}
            <button className="w-full p-4 rounded-xl border-2 border-dashed border-white/10 text-zinc-500 hover:border-blue-500/50 hover:text-blue-400 transition-all">
              + Add Certification
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Venue Detail Modal */}
      <AnimatePresence>
        {selectedVenue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setSelectedVenue(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-white/10"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                  <span className="text-3xl">🏢</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-white">{selectedVenue.venue_name}</h3>
                    {selectedVenue.verified && (
                      <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">{selectedVenue.venue_type}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold text-white">{selectedVenue.shifts_completed}</p>
                  <p className="text-xs text-zinc-500">Shifts</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold text-white">{selectedVenue.hours_worked}</p>
                  <p className="text-xs text-zinc-500">Hours</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold text-white flex items-center justify-center gap-1">
                    {selectedVenue.average_rating.toFixed(1)}
                    <span className="text-yellow-400">★</span>
                  </p>
                  <p className="text-xs text-zinc-500">Rating</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">First Shift</span>
                  <span className="text-white">{formatDate(selectedVenue.first_shift)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Last Shift</span>
                  <span className="text-white">{formatDate(selectedVenue.last_shift)}</span>
                </div>
              </div>

              {selectedVenue.notable_events && selectedVenue.notable_events.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-zinc-500 mb-2">Notable Events Worked</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedVenue.notable_events.map((event) => (
                      <span key={event} className="px-3 py-1 rounded-full bg-purple-500/20 text-sm text-purple-300">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-xs text-green-400">
                  ✓ Verified by Shield GPS Check-in/Check-out
                </p>
              </div>

              <button
                onClick={() => setSelectedVenue(null)}
                className="w-full mt-4 py-2 text-zinc-500 hover:text-white transition-colors text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share/Export CV */}
      <div className="flex gap-3">
        <button className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors">
          📤 Share CV Link
        </button>
        <button className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors">
          📄 Export as PDF
        </button>
      </div>
    </div>
  );
}

// Demo data export for testing
export const DEMO_CV_DATA: Omit<DigitalCVProps, "personnelId"> = {
  name: "James Mitchell",
  photo: undefined,
  sia_number: "1234567890123456",
  sia_verified: true,
  member_since: "2023-03-15",
  tier: {
    tier: "gold",
    points: 2450,
    next_tier_points: 5000,
    benefits: ["Priority shift access", "+15% pay boost", "Premium venue access"],
  },
  total_shifts: 156,
  total_hours: 1248,
  overall_rating: 4.8,
  specializations: ["Door Supervisor", "Event Security", "VIP Protection", "Crowd Management"],
  venues: [
    {
      venue_id: "1",
      venue_name: "The O2 Arena",
      venue_type: "Arena / Concert Venue",
      shifts_completed: 47,
      hours_worked: 376,
      first_shift: "2023-04-12",
      last_shift: "2024-01-15",
      average_rating: 4.9,
      verified: true,
      notable_events: ["Taylor Swift Eras Tour", "UFC 286", "New Year's Eve 2024"],
    },
    {
      venue_id: "2",
      venue_name: "Fabric London",
      venue_type: "Nightclub",
      shifts_completed: 38,
      hours_worked: 304,
      first_shift: "2023-05-20",
      last_shift: "2024-01-20",
      average_rating: 4.7,
      verified: true,
      notable_events: ["Defected Records NYE"],
    },
    {
      venue_id: "3",
      venue_name: "The Shard",
      venue_type: "Corporate / Mixed Use",
      shifts_completed: 24,
      hours_worked: 192,
      first_shift: "2023-08-01",
      last_shift: "2023-12-22",
      average_rating: 5.0,
      verified: true,
    },
    {
      venue_id: "4",
      venue_name: "Ministry of Sound",
      venue_type: "Nightclub",
      shifts_completed: 31,
      hours_worked: 248,
      first_shift: "2023-06-15",
      last_shift: "2024-01-06",
      average_rating: 4.8,
      verified: true,
    },
  ],
  certifications: [
    {
      id: "1",
      name: "SIA Door Supervisor License",
      issuer: "Security Industry Authority",
      issued_date: "2022-06-15",
      expiry_date: "2025-06-14",
      verified: true,
    },
    {
      id: "2",
      name: "First Aid at Work (FAW)",
      issuer: "St John Ambulance",
      issued_date: "2023-02-20",
      expiry_date: "2026-02-19",
      verified: true,
    },
    {
      id: "3",
      name: "ACT Awareness (Counter-Terrorism)",
      issuer: "National Counter Terrorism Security Office",
      issued_date: "2023-09-10",
      verified: true,
    },
  ],
  training: [
    {
      id: "1",
      name: "Counter-Terrorism Basics",
      category: "Safety & Security",
      completed_date: "2024-01-05",
      score: 95,
      badge: "🛡️",
    },
    {
      id: "2",
      name: "Conflict De-escalation",
      category: "Communication",
      completed_date: "2023-11-20",
      score: 88,
      badge: "🤝",
    },
    {
      id: "3",
      name: "First Aid Refresher",
      category: "Medical",
      completed_date: "2023-10-15",
      score: 92,
      badge: "🏥",
    },
    {
      id: "4",
      name: "Crowd Management",
      category: "Event Security",
      completed_date: "2023-08-30",
      score: 90,
      badge: "👥",
    },
    {
      id: "5",
      name: "Drug Awareness",
      category: "Safety & Security",
      completed_date: "2023-07-12",
      score: 85,
      badge: "💊",
    },
  ],
};
