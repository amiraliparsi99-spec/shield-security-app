"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { DemoExportButtons } from "@/components/exports/ExportButtons";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'exports'>('general');
  const [venue, setVenue] = useState({
    name: "The Grand Club",
    address: "123 Broad Street, Birmingham, B1 2AB",
    phone: "0121 456 7890",
    email: "contact@thegrandclub.com",
    capacity: "500",
    venueType: "Nightclub",
  });

  const [notifications, setNotifications] = useState({
    bookingConfirmations: true,
    staffCheckIns: true,
    incidentReports: true,
    invoices: true,
    marketing: false,
  });

  const handleSave = () => {
    alert("Settings saved successfully!");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-400">Manage your venue profile and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'general', label: 'General' },
          { id: 'exports', label: 'Export Reports' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exports Tab */}
      {activeTab === 'exports' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Export Your Data</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Generate PDF invoices for your bookings and reports for accounting.
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

        {/* Venue Details */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Venue Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Venue Name</label>
              <input
                type="text"
                value={venue.name}
                onChange={(e) => setVenue(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Address</label>
              <input
                type="text"
                value={venue.address}
                onChange={(e) => setVenue(prev => ({ ...prev, address: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={venue.phone}
                  onChange={(e) => setVenue(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  value={venue.email}
                  onChange={(e) => setVenue(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Capacity</label>
                <input
                  type="text"
                  value={venue.capacity}
                  onChange={(e) => setVenue(prev => ({ ...prev, capacity: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Venue Type</label>
                <select
                  value={venue.venueType}
                  onChange={(e) => setVenue(prev => ({ ...prev, venueType: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                >
                  <option value="Nightclub">Nightclub</option>
                  <option value="Bar">Bar / Pub</option>
                  <option value="Event Space">Event Space</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Corporate">Corporate Building</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Notifications</h2>
          
          <div className="space-y-4">
            {Object.entries({
              bookingConfirmations: "Booking confirmations",
              staffCheckIns: "Staff check-in alerts",
              incidentReports: "Incident reports",
              invoices: "Invoice notifications",
              marketing: "Marketing & updates",
            }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-white">{label}</span>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }))}
                  className={`w-12 h-6 rounded-full transition relative ${
                    notifications[key as keyof typeof notifications]
                      ? "bg-purple-500"
                      : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                      notifications[key as keyof typeof notifications]
                        ? "left-7"
                        : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Payment Methods</h2>
          
          <div className="bg-white/5 rounded-lg p-4 flex items-center gap-4">
            <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">VISA</span>
            </div>
            <div className="flex-1">
              <p className="text-white">•••• •••• •••• 4242</p>
              <p className="text-xs text-zinc-500">Expires 12/27</p>
            </div>
            <button className="text-sm text-purple-400 hover:text-purple-300 transition">
              Edit
            </button>
          </div>

          <button className="mt-4 text-sm text-purple-400 hover:text-purple-300 transition">
            + Add payment method
          </button>
        </div>

        {/* Danger Zone */}
        <div className="glass rounded-xl p-6 border border-red-500/30">
          <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Delete Account</p>
              <p className="text-sm text-zinc-500">Permanently delete your venue and all data</p>
            </div>
            <button className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 rounded-lg text-sm transition">
              Delete Account
            </button>
          </div>
        </div>

        {/* Save Button */}
        <motion.button
          onClick={handleSave}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-medium transition"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          Save Changes
        </motion.button>
      </div>
      )}
    </div>
  );
}
