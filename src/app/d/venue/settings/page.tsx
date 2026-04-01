"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { DemoExportButtons } from "@/components/exports/ExportButtons";

const venueTypes = [
  { value: "club", label: "Nightclub" },
  { value: "bar", label: "Bar / Pub" },
  { value: "stadium", label: "Stadium / Arena" },
  { value: "event_space", label: "Event Space" },
  { value: "restaurant", label: "Restaurant" },
  { value: "corporate", label: "Corporate Building" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"general" | "exports">("general");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [venue, setVenue] = useState({
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    phone: "",
    email: "",
    capacity: "",
    type: "",
  });

  const [notifications, setNotifications] = useState({
    bookingConfirmations: true,
    staffCheckIns: true,
    incidentReports: true,
    invoices: true,
    marketing: false,
  });

  useEffect(() => {
    loadVenue();
  }, []);

  const loadVenue = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("venues")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setVenueId(data.id);
        setVenue({
          name: data.name || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          city: data.city || "",
          postcode: data.postcode || "",
          phone: data.phone || "",
          email: data.email || "",
          capacity: data.capacity ? String(data.capacity) : "",
          type: data.type || "",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!venueId) return;
    setIsSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase
        .from("venues")
        .update({
          name: venue.name,
          address_line1: venue.address_line1,
          address_line2: venue.address_line2 || null,
          city: venue.city,
          postcode: venue.postcode,
          phone: venue.phone || null,
          email: venue.email || null,
          capacity: venue.capacity ? parseInt(venue.capacity) : null,
          type: venue.type || null,
        })
        .eq("id", venueId);

      if (!error) setSaved(true);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-[#00d4aa]/50 focus:outline-none focus:ring-1 focus:ring-[#00d4aa]/20 transition";

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <div className="mb-8">
          <div className="h-8 w-32 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-4 w-56 mt-2 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-400">Manage your venue profile and preferences</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {([{ id: "general", label: "General" }, { id: "exports", label: "Export Reports" }] as const).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeTab === tab.id ? "bg-[#00d4aa] text-[#0c0d10]" : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "exports" && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Export Your Data</h3>
            <p className="text-sm text-zinc-400 mb-6">Generate PDF invoices for your bookings and reports for accounting.</p>
            <DemoExportButtons />
          </div>
        </div>
      )}

      {activeTab === "general" && (
        <div className="space-y-6">
          <ThemeToggle />

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Venue Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Venue Name</label>
                <input type="text" value={venue.name} onChange={(e) => setVenue((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Address Line 1</label>
                <input type="text" value={venue.address_line1} onChange={(e) => setVenue((p) => ({ ...p, address_line1: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Address Line 2</label>
                <input type="text" value={venue.address_line2} onChange={(e) => setVenue((p) => ({ ...p, address_line2: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">City</label>
                  <input type="text" value={venue.city} onChange={(e) => setVenue((p) => ({ ...p, city: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Postcode</label>
                  <input type="text" value={venue.postcode} onChange={(e) => setVenue((p) => ({ ...p, postcode: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
                  <input type="tel" value={venue.phone} onChange={(e) => setVenue((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                  <input type="email" value={venue.email} onChange={(e) => setVenue((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Capacity</label>
                  <input type="number" value={venue.capacity} onChange={(e) => setVenue((p) => ({ ...p, capacity: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Venue Type</label>
                  <select value={venue.type} onChange={(e) => setVenue((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
                    <option value="">Select type...</option>
                    {venueTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

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
                  <button onClick={() => setNotifications((p) => ({ ...p, [key]: !p[key as keyof typeof notifications] }))} className={`w-12 h-6 rounded-full transition relative ${notifications[key as keyof typeof notifications] ? "bg-[#00d4aa]" : "bg-white/20"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${notifications[key as keyof typeof notifications] ? "left-7" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <motion.button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#00d4aa] hover:bg-[#00e5b8] text-[#0c0d10] py-3 rounded-xl font-semibold transition disabled:opacity-60"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {isSaving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </motion.button>
        </div>
      )}
    </div>
  );
}
