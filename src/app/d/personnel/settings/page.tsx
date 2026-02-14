"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { InsuranceVerification } from "@/components/verification/InsuranceVerification";
import { DemoExportButtons } from "@/components/exports/ExportButtons";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'insurance' | 'exports'>('general');
  const [notifications, setNotifications] = useState({
    newJobs: true,
    shiftReminders: true,
    paymentUpdates: true,
    messages: true,
    marketing: false,
  });

  const [preferences, setPreferences] = useState({
    maxDistance: 10,
    nightShifts: true,
    weekendOnly: false,
  });

  const handleSave = () => {
    alert("Settings saved successfully!");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-400">Manage your account preferences</p>
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
        <InsuranceVerification userType="personnel" />
      )}

      {/* Exports Tab */}
      {activeTab === 'exports' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Export Your Data</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Generate PDF reports for your shifts and earnings. Great for tax records and invoices.
            </p>
            <DemoExportButtons />
          </div>
        </div>
      )}

      {/* General Tab */}
      {activeTab === 'general' && (
      <div className="space-y-6">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Notifications</h3>
          <div className="space-y-4">
            {Object.entries({
              newJobs: "New job alerts matching your preferences",
              shiftReminders: "Upcoming shift reminders",
              paymentUpdates: "Payment and earnings updates",
              messages: "New messages from venues and agencies",
              marketing: "Tips, news, and promotional offers",
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-white">{label}</span>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }))}
                  className={`w-12 h-6 rounded-full transition relative ${
                    notifications[key as keyof typeof notifications] ? "bg-shield-500" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                      notifications[key as keyof typeof notifications] ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Job Preferences */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Job Preferences</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Maximum Travel Distance</label>
              <select
                value={preferences.maxDistance}
                onChange={(e) => setPreferences(prev => ({ ...prev, maxDistance: parseInt(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              >
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={20}>20 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white">Night shifts (after 10pm)</span>
              <button
                onClick={() => setPreferences(prev => ({ ...prev, nightShifts: !prev.nightShifts }))}
                className={`w-12 h-6 rounded-full transition relative ${
                  preferences.nightShifts ? "bg-shield-500" : "bg-white/20"
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                  preferences.nightShifts ? "left-7" : "left-1"
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white">Weekend shifts only</span>
              <button
                onClick={() => setPreferences(prev => ({ ...prev, weekendOnly: !prev.weekendOnly }))}
                className={`w-12 h-6 rounded-full transition relative ${
                  preferences.weekendOnly ? "bg-shield-500" : "bg-white/20"
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                  preferences.weekendOnly ? "left-7" : "left-1"
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Payment Details</h3>
          <div className="bg-white/5 rounded-lg p-4 flex items-center gap-4">
            <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">BANK</span>
            </div>
            <div className="flex-1">
              <p className="text-white">Barclays •••• 4521</p>
              <p className="text-xs text-zinc-500">M. Johnson</p>
            </div>
            <button className="text-sm text-shield-400 hover:text-shield-300 transition">
              Edit
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass rounded-xl p-6 border border-red-500/30">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Deactivate Account</p>
                <p className="text-sm text-zinc-500">Temporarily hide your profile from venues</p>
              </div>
              <button className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 px-4 py-2 rounded-lg text-sm transition">
                Deactivate
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Delete Account</p>
                <p className="text-sm text-zinc-500">Permanently delete your account and data</p>
              </div>
              <button className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 rounded-lg text-sm transition">
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <motion.button
          onClick={handleSave}
          className="w-full bg-shield-500 hover:bg-shield-600 text-white py-3 rounded-xl font-medium transition"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          Save Settings
        </motion.button>
      </div>
      )}
    </div>
  );
}
