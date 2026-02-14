"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SHIFT_TYPES = [
  { value: "door_supervisor", label: "Door Supervisor" },
  { value: "cctv_operator", label: "CCTV Operator" },
  { value: "close_protection", label: "Close Protection" },
  { value: "event_security", label: "Event Security" },
  { value: "retail_security", label: "Retail Security" },
  { value: "corporate_security", label: "Corporate Security" },
  { value: "mobile_patrol", label: "Mobile Patrol" },
  { value: "static_guard", label: "Static Guard" },
  { value: "concierge", label: "Concierge" },
  { value: "other", label: "Other" },
];

const REQUIREMENTS_OPTIONS = [
  "SIA Door Supervisor",
  "SIA CCTV",
  "SIA Close Protection",
  "DBS Checked",
  "First Aid Certified",
  "Own Transport",
  "Smart Appearance",
  "Previous Experience",
  "Physical Fitness",
];

interface Props {
  venueId?: string;
  agencyId?: string;
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PostShiftForm({
  venueId,
  agencyId,
  userId,
  onSuccess,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    shift_type: "door_supervisor",
    location_name: "",
    location_address: "",
    shift_date: "",
    start_time: "18:00",
    end_time: "02:00",
    hourly_rate: "15.00",
    positions_available: 1,
    requirements: [] as string[],
    sia_required: true,
    dress_code: "",
    urgency: "normal",
    application_deadline: "",
  });
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("shift_posts").insert({
        venue_id: venueId || null,
        agency_id: agencyId || null,
        posted_by: userId,
        title: form.title,
        description: form.description || null,
        shift_type: form.shift_type,
        location_name: form.location_name,
        location_address: form.location_address || null,
        shift_date: form.shift_date,
        start_time: form.start_time,
        end_time: form.end_time,
        hourly_rate: parseFloat(form.hourly_rate),
        positions_available: form.positions_available,
        requirements: form.requirements.length > 0 ? form.requirements : null,
        sia_required: form.sia_required,
        dress_code: form.dress_code || null,
        urgency: form.urgency,
        application_deadline: form.application_deadline || null,
        status: "open",
      });

      if (error) throw error;

      onSuccess?.();
    } catch (error) {
      console.error("Failed to post shift:", error);
      alert("Failed to post shift");
    } finally {
      setLoading(false);
    }
  };

  const toggleRequirement = (req: string) => {
    setForm((prev) => ({
      ...prev,
      requirements: prev.requirements.includes(req)
        ? prev.requirements.filter((r) => r !== req)
        : [...prev.requirements, req],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="font-medium text-white">Basic Information</h4>

        <div>
          <label className="block text-sm text-dark-300 mb-2">
            Shift Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Door Supervisor - Friday Night"
            required
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-300 mb-2">
              Shift Type *
            </label>
            <select
              value={form.shift_type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, shift_type: e.target.value }))
              }
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
            >
              {SHIFT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-dark-300 mb-2">Urgency</label>
            <select
              value={form.urgency}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, urgency: e.target.value }))
              }
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
            >
              <option value="normal">Normal</option>
              <option value="urgent">⚡ Urgent</option>
              <option value="emergency">🚨 Emergency</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-dark-300 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={3}
            placeholder="Describe the shift, duties, and any specific requirements..."
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <h4 className="font-medium text-white">Location</h4>

        <div>
          <label className="block text-sm text-dark-300 mb-2">
            Location Name *
          </label>
          <input
            type="text"
            value={form.location_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, location_name: e.target.value }))
            }
            placeholder="e.g. The Grand Hotel"
            required
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-dark-300 mb-2">
            Full Address
          </label>
          <input
            type="text"
            value={form.location_address}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, location_address: e.target.value }))
            }
            placeholder="123 Main Street, London EC1A 1BB"
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-4">
        <h4 className="font-medium text-white">Date & Time</h4>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-dark-300 mb-2">Date *</label>
            <input
              type="date"
              value={form.shift_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, shift_date: e.target.value }))
              }
              required
              min={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-dark-300 mb-2">
              Start Time *
            </label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, start_time: e.target.value }))
              }
              required
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-dark-300 mb-2">
              End Time *
            </label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, end_time: e.target.value }))
              }
              required
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-dark-300 mb-2">
            Application Deadline
          </label>
          <input
            type="datetime-local"
            value={form.application_deadline}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                application_deadline: e.target.value,
              }))
            }
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Pay & Positions */}
      <div className="space-y-4">
        <h4 className="font-medium text-white">Pay & Positions</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-300 mb-2">
              Hourly Rate (£) *
            </label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={form.hourly_rate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, hourly_rate: e.target.value }))
              }
              required
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-dark-300 mb-2">
              Positions Available *
            </label>
            <input
              type="number"
              min="1"
              value={form.positions_available}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  positions_available: parseInt(e.target.value) || 1,
                }))
              }
              required
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div className="space-y-4">
        <h4 className="font-medium text-white">Requirements</h4>

        <div className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-lg">
          <input
            type="checkbox"
            id="sia_required"
            checked={form.sia_required}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sia_required: e.target.checked }))
            }
            className="w-5 h-5 rounded border-dark-600 bg-dark-700 text-accent focus:ring-accent"
          />
          <label htmlFor="sia_required" className="text-white">
            SIA License Required
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {REQUIREMENTS_OPTIONS.map((req) => (
            <button
              key={req}
              type="button"
              onClick={() => toggleRequirement(req)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                form.requirements.includes(req)
                  ? "bg-accent text-white"
                  : "bg-dark-700 text-dark-300 hover:bg-dark-600"
              }`}
            >
              {req}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm text-dark-300 mb-2">Dress Code</label>
          <input
            type="text"
            value={form.dress_code}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, dress_code: e.target.value }))
            }
            placeholder="e.g. Smart black suit, polished shoes"
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-3 bg-accent hover:bg-accent-dark disabled:bg-accent/50 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? "Posting..." : "Post Shift"}
        </button>
      </div>
    </form>
  );
}
