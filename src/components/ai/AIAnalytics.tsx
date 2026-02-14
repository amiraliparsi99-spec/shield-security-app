"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface AIStats {
  total_conversations: number;
  avg_rating: number | null;
  helpful_rate: number | null;
  top_categories: { query_category: string; count: number }[] | null;
  conversations_by_role: Record<string, number> | null;
}

interface CommonQuestion {
  id: string;
  question: string;
  ask_count: number;
  avg_rating: number | null;
  is_curated: boolean;
}

export function AIAnalytics() {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const supabase = createClient();

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Get AI stats
      const { data: statsData } = await supabase
        .rpc("get_ai_stats", { days_back: timeRange });
      
      if (statsData) {
        setStats(statsData);
      }

      // Get common questions
      const { data: questionsData } = await supabase
        .from("ai_common_questions")
        .select("id, question, ask_count, avg_rating, is_curated")
        .order("ask_count", { ascending: false })
        .limit(10);

      if (questionsData) {
        setCommonQuestions(questionsData);
      }
    } catch (error) {
      console.error("Failed to load AI stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-dark-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-dark-700 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            🛡️ Shield AI Analytics
          </h2>
          <p className="text-dark-400 text-sm mt-1">
            Training data collection for Phase 3 vertical AI
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <p className="text-dark-400 text-sm">Total Conversations</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats?.total_conversations || 0}
          </p>
          <p className="text-xs text-emerald-400 mt-1">Training samples</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <p className="text-dark-400 text-sm">Average Rating</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats?.avg_rating ? `${stats.avg_rating}/5` : "N/A"}
          </p>
          <p className="text-xs text-dark-500 mt-1">User feedback</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <p className="text-dark-400 text-sm">Helpful Rate</p>
          <p className="text-2xl font-bold text-white mt-1">
            {stats?.helpful_rate ? `${stats.helpful_rate}%` : "N/A"}
          </p>
          <p className="text-xs text-dark-500 mt-1">Positive feedback</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <p className="text-dark-400 text-sm">Training Ready</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {stats?.total_conversations && stats.total_conversations >= 1000
              ? "Yes"
              : `${((stats?.total_conversations || 0) / 1000 * 100).toFixed(0)}%`}
          </p>
          <p className="text-xs text-dark-500 mt-1">Need 10K for Phase 3</p>
        </div>
      </div>

      {/* Conversations by Role */}
      {stats?.conversations_by_role && (
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h3 className="font-semibold text-white mb-4">Usage by Role</h3>
          <div className="flex gap-4">
            {Object.entries(stats.conversations_by_role).map(([role, count]) => (
              <div key={role} className="flex-1 text-center">
                <div className="text-2xl mb-1">
                  {role === "venue" ? "🏢" : role === "agency" ? "🏛️" : "👤"}
                </div>
                <p className="text-lg font-semibold text-white">{count}</p>
                <p className="text-xs text-dark-400 capitalize">{role}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Questions */}
      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Most Asked Questions</h3>
          <span className="text-xs text-dark-500">For FAQ & training curation</span>
        </div>
        {commonQuestions.length > 0 ? (
          <div className="space-y-3">
            {commonQuestions.map((q, i) => (
              <div
                key={q.id}
                className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg"
              >
                <span className="text-lg font-bold text-dark-500 w-6">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{q.question}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-dark-400">
                      Asked {q.ask_count}x
                    </span>
                    {q.avg_rating && (
                      <span className="text-xs text-dark-400">
                        ⭐ {q.avg_rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                {q.is_curated && (
                  <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                    Curated
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-500 text-sm text-center py-8">
            Questions will appear here as users interact with Shield AI
          </p>
        )}
      </div>

      {/* Phase 3 Progress */}
      <div className="bg-gradient-to-r from-accent/10 to-emerald-500/10 rounded-xl p-6 border border-accent/30">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🚀</span>
          <div>
            <h3 className="font-semibold text-white">Phase 3: Custom Model Training</h3>
            <p className="text-sm text-dark-400">
              Collecting data for your unique security AI
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-dark-400">Training Data Progress</span>
              <span className="text-white">
                {stats?.total_conversations || 0} / 10,000 conversations
              </span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-emerald-500 transition-all"
                style={{
                  width: `${Math.min(((stats?.total_conversations || 0) / 10000) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
          <p className="text-xs text-dark-500">
            Once you reach 10,000 quality conversations with feedback, you'll have enough
            data to fine-tune a custom model that thinks like Shield.
          </p>
        </div>
      </div>
    </div>
  );
}
