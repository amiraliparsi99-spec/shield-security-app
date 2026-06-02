"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/hooks/useSupabase";
import { isMissingColumnError } from "@/lib/postgresErrors";
import { bookingDirectionsLine } from "@/lib/bookingDirections";

type JobDetail = {
  id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  booking: {
    id: string;
    event_name: string;
    brief_notes: string | null;
    site_label?: string | null;
    site_address_text?: string | null;
    venue_location?: {
      label?: string | null;
      address_line1?: string | null;
      city?: string | null;
      postcode?: string | null;
    } | null;
    venue: {
      id: string;
      name: string;
      city: string;
      address_line1: string | null;
      postcode?: string | null;
    } | null;
  } | null;
};

function extractAttireRequirement(briefNotes?: string | null): string | null {
  if (!briefNotes) return null;
  const match = briefNotes.match(/Attire requirement:\s*(.+)/i);
  return match?.[1]?.trim() || null;
}

export default function PersonnelJobDetailPage() {
  const params = useParams();
  const supabase = useSupabase();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!params.id) return;
      setLoading(true);
      const selectFull = `
          id, role, hourly_rate, scheduled_start, scheduled_end, status,
          booking:bookings(
            id, event_name, brief_notes, site_label, site_address_text,
            venue_location:venue_locations!venue_location_id(label, address_line1, city, postcode),
            venue:venues(id, name, city, address_line1, postcode)
          )
        `;
      const selectLegacy = `
          id, role, hourly_rate, scheduled_start, scheduled_end, status,
          booking:bookings(
            id, event_name, brief_notes, site_label,
            venue_location:venue_locations!venue_location_id(label, address_line1, city, postcode),
            venue:venues(id, name, city, address_line1, postcode)
          )
        `;
      let { data, error } = await supabase
        .from("shifts")
        .select(selectFull)
        .eq("id", params.id)
        .single();
      if (error && isMissingColumnError(error)) {
        const retry = await supabase
          .from("shifts")
          .select(selectLegacy)
          .eq("id", params.id)
          .single();
        data = retry.data as typeof data;
        error = retry.error;
      }
      if (!cancelled) {
        setJob((data || null) as any);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, supabase]);

  const attire = useMemo(() => extractAttireRequirement(job?.booking?.brief_notes), [job?.booking?.brief_notes]);
  const notes = useMemo(() => (job?.booking?.brief_notes || "").replace(/Attire requirement:\s*.+/i, "").trim(), [job?.booking?.brief_notes]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8">
        <p className="text-zinc-400">Job not found.</p>
      </div>
    );
  }

  const start = new Date(job.scheduled_start);
  const end = new Date(job.scheduled_end);
  const hours = Math.max(0, (end.getTime() - start.getTime()) / 3600000);
  const pay = Math.round(hours * (job.hourly_rate || 0));

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Link href="/d/personnel/jobs" className="text-zinc-400 hover:text-white text-sm mb-4 inline-block">
        ← Back to Jobs
      </Link>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-bold text-white">{job.booking?.event_name || "Event"}</h1>
        <p className="text-zinc-400">{job.role}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Time</p>
            <p className="text-white text-sm mt-1">
              {start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-zinc-300 text-sm">
              {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} -{" "}
              {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Estimated Pay</p>
            <p className="text-emerald-400 text-2xl font-bold mt-1">£{pay}</p>
            <p className="text-zinc-400 text-xs">{hours.toFixed(1)}h at £{job.hourly_rate}/hr</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-zinc-500">Location</p>
          <p className="text-white mt-1">{job.booking?.venue?.name || "Venue"}</p>
          <p className="text-zinc-400 text-sm">
            {job.booking ? bookingDirectionsLine(job.booking) : "Address not provided"}
          </p>
        </div>

        <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
          <p className="text-xs text-blue-300">Required Attire</p>
          <p className="text-white mt-1">{attire || "No specific attire provided"}</p>
        </div>

        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-zinc-500">Who / Event Type</p>
          <p className="text-white mt-1">{job.booking?.venue?.name || "Venue team"}</p>
          <p className="text-zinc-400 text-sm">{job.role} for {job.booking?.event_name || "event security"}</p>
        </div>

        {notes ? (
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Details / Description</p>
            <p className="text-white mt-1">{notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
