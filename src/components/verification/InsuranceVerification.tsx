"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase, useUser } from "@/hooks/useSupabase";

type InsuranceType = 'public_liability' | 'employers_liability' | 'professional_indemnity' | 'personal_accident';
type InsuranceStatus = 'pending' | 'verified' | 'rejected' | 'expired';

interface InsuranceRecord {
  id: string;
  insurance_type: InsuranceType;
  provider_name: string;
  policy_number: string;
  coverage_amount: number | null;
  start_date: string;
  expiry_date: string;
  document_url: string | null;
  status: InsuranceStatus;
  rejection_reason: string | null;
  created_at: string;
}

const INSURANCE_TYPES: { value: InsuranceType; label: string; description: string }[] = [
  { value: 'public_liability', label: 'Public Liability', description: 'Covers claims from the public for injury or property damage' },
  { value: 'employers_liability', label: "Employer's Liability", description: 'Required if you employ staff - covers workplace injuries' },
  { value: 'professional_indemnity', label: 'Professional Indemnity', description: 'Covers claims of professional negligence' },
  { value: 'personal_accident', label: 'Personal Accident', description: 'Covers injuries sustained while working' },
];

const STATUS_CONFIG: Record<InsuranceStatus, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Pending Review' },
  verified: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Verified' },
  rejected: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Rejected' },
  expired: { color: 'text-zinc-400', bg: 'bg-zinc-500/20', label: 'Expired' },
};

export function InsuranceVerification({ userType = 'personnel' }: { userType?: 'personnel' | 'agency' }) {
  const supabase = useSupabase();
  const { user } = useUser();
  
  const [records, setRecords] = useState<InsuranceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    insurance_type: 'public_liability' as InsuranceType,
    provider_name: '',
    policy_number: '',
    coverage_amount: '',
    start_date: '',
    expiry_date: '',
  });

  useEffect(() => {
    if (user) loadRecords();
  }, [user]);

  const loadRecords = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('insurance_records')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Check for expired records
      const updated = data.map(record => {
        if (record.status === 'verified' && new Date(record.expiry_date) < new Date()) {
          return { ...record, status: 'expired' as InsuranceStatus };
        }
        return record;
      });
      setRecords(updated);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);

    const { error } = await supabase
      .from('insurance_records')
      .insert({
        user_id: user.id,
        user_type: userType,
        insurance_type: formData.insurance_type,
        provider_name: formData.provider_name,
        policy_number: formData.policy_number,
        coverage_amount: formData.coverage_amount ? parseFloat(formData.coverage_amount) : null,
        start_date: formData.start_date,
        expiry_date: formData.expiry_date,
        status: 'pending',
      });

    setSubmitting(false);

    if (!error) {
      setShowForm(false);
      setFormData({
        insurance_type: 'public_liability',
        provider_name: '',
        policy_number: '',
        coverage_amount: '',
        start_date: '',
        expiry_date: '',
      });
      loadRecords();
    }
  };

  const getExpiryWarning = (expiryDate: string) => {
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Expired', urgent: true };
    if (days <= 7) return { text: `Expires in ${days} days`, urgent: true };
    if (days <= 30) return { text: `Expires in ${days} days`, urgent: false };
    return null;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Insurance Verification</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Upload your insurance certificates for verification
          </p>
        </div>
        <motion.button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-shield-500 hover:bg-shield-600 text-white font-medium transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + Add Insurance
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: records.length, color: 'text-white' },
          { label: 'Verified', value: records.filter(r => r.status === 'verified').length, color: 'text-emerald-400' },
          { label: 'Pending', value: records.filter(r => r.status === 'pending').length, color: 'text-amber-400' },
          { label: 'Expired', value: records.filter(r => r.status === 'expired' || (r.status === 'verified' && new Date(r.expiry_date) < new Date())).length, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-zinc-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Records List */}
      {records.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <ShieldIcon className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-zinc-400">No insurance records yet</p>
          <p className="text-sm text-zinc-500 mt-1">Add your insurance certificates to get verified</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const status = STATUS_CONFIG[record.status];
            const warning = getExpiryWarning(record.expiry_date);
            const typeInfo = INSURANCE_TYPES.find(t => t.value === record.insurance_type);

            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${status.bg} flex items-center justify-center`}>
                      <ShieldIcon className={`w-6 h-6 ${status.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{typeInfo?.label}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">{record.provider_name}</p>
                      <p className="text-xs text-zinc-500">Policy: {record.policy_number}</p>
                      {record.coverage_amount && (
                        <p className="text-xs text-zinc-500">Coverage: £{record.coverage_amount.toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {warning && (
                      <p className={`text-xs font-medium ${warning.urgent ? 'text-red-400' : 'text-amber-400'}`}>
                        {warning.text}
                      </p>
                    )}
                    <p className="text-sm text-zinc-400">
                      Expires: {new Date(record.expiry_date).toLocaleDateString('en-GB')}
                    </p>
                    {record.rejection_reason && (
                      <p className="text-xs text-red-400 mt-1">{record.rejection_reason}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Insurance Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg glass rounded-2xl p-6"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Add Insurance</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-zinc-400 hover:text-white transition"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Insurance Type */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Insurance Type
                  </label>
                  <select
                    value={formData.insurance_type}
                    onChange={(e) => setFormData({ ...formData, insurance_type: e.target.value as InsuranceType })}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-shield-500 focus:outline-none"
                    required
                  >
                    {INSURANCE_TYPES.map((type) => (
                      <option key={type.value} value={type.value} className="bg-zinc-900">
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-1">
                    {INSURANCE_TYPES.find(t => t.value === formData.insurance_type)?.description}
                  </p>
                </div>

                {/* Provider Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    value={formData.provider_name}
                    onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                    placeholder="e.g., Hiscox, AXA, Aviva"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Policy Number */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Policy Number
                  </label>
                  <input
                    type="text"
                    value={formData.policy_number}
                    onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                    placeholder="Enter your policy number"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Coverage Amount */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Coverage Amount (£)
                  </label>
                  <input
                    type="number"
                    value={formData.coverage_amount}
                    onChange={(e) => setFormData({ ...formData, coverage_amount: e.target.value })}
                    placeholder="e.g., 5000000"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-shield-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-shield-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3 rounded-lg bg-shield-500 hover:bg-shield-600 disabled:opacity-50 text-white font-medium transition"
                  >
                    {submitting ? 'Submitting...' : 'Submit for Verification'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
