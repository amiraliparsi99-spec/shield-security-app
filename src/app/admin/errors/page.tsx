"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  context: Record<string, unknown>;
  environment: string;
  resolved: boolean;
  created_at: string;
}

const SEVERITY_CONFIG = {
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Low' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Medium' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'High' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Critical' },
};

export default function AdminErrorsPage() {
  const supabase = createClient();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'critical'>('unresolved');
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    unresolved: 0,
  });

  useEffect(() => {
    loadErrors();
    loadStats();
  }, [filter]);

  const loadErrors = async () => {
    setLoading(true);
    
    let query = supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter === 'unresolved') {
      query = query.eq('resolved', false);
    } else if (filter === 'critical') {
      query = query.in('severity', ['critical', 'high']);
    }

    const { data, error } = await query;

    if (!error && data) {
      setErrors(data);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const { data, error } = await supabase
      .rpc('get_error_stats', { p_hours: 24 });

    if (!error && data && data.length > 0) {
      setStats({
        total: Number(data[0].total_errors) || 0,
        critical: Number(data[0].critical_errors) || 0,
        high: Number(data[0].high_errors) || 0,
        unresolved: Number(data[0].unresolved_errors) || 0,
      });
    }
  };

  const markResolved = async (id: string) => {
    const { error } = await supabase
      .from('error_logs')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      loadErrors();
      loadStats();
      setSelectedError(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Error Monitor</h1>
        <p className="text-sm text-zinc-400">Track and resolve application errors</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Last 24h', value: stats.total, color: 'text-white' },
          { label: 'Critical', value: stats.critical, color: 'text-red-400' },
          { label: 'High', value: stats.high, color: 'text-orange-400' },
          { label: 'Unresolved', value: stats.unresolved, color: 'text-amber-400' },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-zinc-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'unresolved', label: 'Unresolved' },
          { id: 'critical', label: 'Critical & High' },
          { id: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.id
                ? 'bg-shield-500 text-white'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-shield-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : errors.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-zinc-400">No errors found</p>
          <p className="text-sm text-zinc-500 mt-1">That's a good thing!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map((error) => {
            const severity = SEVERITY_CONFIG[error.severity];
            
            return (
              <motion.div
                key={error.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-xl p-4 cursor-pointer transition hover:bg-white/5 ${
                  error.resolved ? 'opacity-60' : ''
                }`}
                onClick={() => setSelectedError(error)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severity.bg} ${severity.color}`}>
                        {severity.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-zinc-400">
                        {error.category}
                      </span>
                      {error.resolved && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium truncate">{error.message}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatDate(error.created_at)} • {error.environment}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Error Detail Modal */}
      {selectedError && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setSelectedError(null)}
        >
          <motion.div
            className="w-full max-w-2xl glass rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_CONFIG[selectedError.severity].bg} ${SEVERITY_CONFIG[selectedError.severity].color}`}>
                    {SEVERITY_CONFIG[selectedError.severity].label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-zinc-400">
                    {selectedError.category}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{selectedError.message}</h3>
              </div>
              <button
                onClick={() => setSelectedError(null)}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-zinc-400 mb-1">Timestamp</p>
                <p className="text-white">{new Date(selectedError.created_at).toLocaleString()}</p>
              </div>

              {selectedError.stack && (
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Stack Trace</p>
                  <pre className="bg-black/50 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto">
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              {Object.keys(selectedError.context).length > 0 && (
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Context</p>
                  <pre className="bg-black/50 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto">
                    {JSON.stringify(selectedError.context, null, 2)}
                  </pre>
                </div>
              )}

              {!selectedError.resolved && (
                <button
                  onClick={() => markResolved(selectedError.id)}
                  className="w-full px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition"
                >
                  Mark as Resolved
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
