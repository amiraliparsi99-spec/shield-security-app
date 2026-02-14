"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Agency } from "@/types/database";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { InsuranceVerification } from "@/components/verification/InsuranceVerification";
import { DemoExportButtons } from "@/components/exports/ExportButtons";

export default function AgencySettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'insurance' | 'exports'>('general');
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rate_per_hour: "",
    city: "",
    region: "",
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadAgency();
  }, []);

  const loadAgency = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data: agencyData } = await supabase
        .from("agencies")
        .select("*")
        .eq("owner_id", profile.id)
        .single();

      if (agencyData) {
        setAgency(agencyData);
        setFormData({
          name: agencyData.name || "",
          description: agencyData.description || "",
          rate_per_hour: agencyData.rate_per_hour ? (agencyData.rate_per_hour / 100).toFixed(2) : "",
          city: agencyData.city || "",
          region: agencyData.region || "",
        });
      }
    } catch (error) {
      console.error("Error loading agency:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agency) return;

    setIsSaving(true);
    setSuccess(false);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("agencies")
        .update({
          name: formData.name,
          description: formData.description || null,
          rate_per_hour: formData.rate_per_hour ? Math.round(parseFloat(formData.rate_per_hour) * 100) : null,
          city: formData.city || null,
          region: formData.region || null,
        })
        .eq("id", agency.id);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsSaving(false);
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
        <h1 className="font-display text-2xl font-semibold text-white">Agency Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your agency profile and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'general', label: 'General' },
          { id: 'insurance', label: 'Insurance' },
          { id: 'exports', label: 'Export Reports' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-shield-500 text-white'
                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Insurance Tab */}
      {activeTab === 'insurance' && (
        <div className="mx-auto max-w-2xl">
          <InsuranceVerification userType="agency" />
        </div>
      )}

      {/* Exports Tab */}
      {activeTab === 'exports' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Export Your Data</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Generate PDF invoices for clients and shift reports for your staff.
            </p>
            <DemoExportButtons />
          </div>
        </div>
      )}

      {/* General Tab */}
      {activeTab === 'general' && (
      <div className="mx-auto max-w-2xl">
        {/* Theme Toggle */}
        <div className="mb-6">
          <ThemeToggle />
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-medium text-white">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-zinc-300">
                  Agency Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none transition focus:border-shield-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-2 block text-sm font-medium text-zinc-300">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Tell venues about your agency..."
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
                />
              </div>
            </div>
          </div>

          {/* Rates */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-medium text-white">Pricing</h2>
            
            <div>
              <label htmlFor="rate" className="mb-2 block text-sm font-medium text-zinc-300">
                Default Hourly Rate
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">£</span>
                <input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate_per_hour}
                  onChange={(e) => setFormData({ ...formData, rate_per_hour: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-8 pr-12 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">/hr</span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                This is your default rate. You can set different rates per staff member.
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-medium text-white">Location</h2>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className="mb-2 block text-sm font-medium text-zinc-300">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. London"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
                />
              </div>
              <div>
                <label htmlFor="region" className="mb-2 block text-sm font-medium text-zinc-300">
                  Region
                </label>
                <input
                  id="region"
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="e.g. Greater London"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
                />
              </div>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="rounded-xl bg-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
              Settings saved successfully!
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-xl bg-shield-500 px-4 py-3 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Verification Status */}
        <div className="mt-6 glass rounded-2xl p-6">
          <h2 className="mb-4 font-display text-lg font-medium text-white">Verification Status</h2>
          
          <div className="flex items-center gap-3">
            {agency?.insurance_verified ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                  <svg className="h-5 w-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Verified Agency</p>
                  <p className="text-sm text-zinc-400">Your agency has been verified</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                  <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Verification Pending</p>
                  <p className="text-sm text-zinc-400">Complete verification to unlock more features</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
