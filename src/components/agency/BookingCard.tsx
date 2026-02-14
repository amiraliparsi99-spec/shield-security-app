"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Booking, BookingStatus } from "@/types/database";

interface BookingCardProps {
  booking: Booking & {
    venue?: { name: string; address?: string };
    assignedCount?: number;
  };
}

export function BookingCard({ booking }: BookingCardProps) {
  const startDate = new Date(booking.start);
  const endDate = new Date(booking.end);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const durationHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
  const assignmentProgress = booking.assignedCount !== undefined 
    ? `${booking.assignedCount}/${booking.guards_count}` 
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass group rounded-xl p-4 transition-all hover:shadow-glow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Venue */}
          <h3 className="font-medium text-white">
            {booking.venue?.name || "Unknown Venue"}
          </h3>
          {booking.venue?.address && (
            <p className="mt-0.5 text-sm text-zinc-400">{booking.venue.address}</p>
          )}

          {/* Date & Time */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(startDate)}
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(startDate)} - {formatTime(endDate)}
            </span>
            <span className="text-zinc-500">({durationHours}h)</span>
          </div>

          {/* Guards & Rate */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-sm">
              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-zinc-300">{booking.guards_count} guards</span>
            </span>
            <span className="text-sm font-medium text-shield-400">
              £{(booking.rate / 100).toFixed(2)}/hr
            </span>
            {assignmentProgress && (
              <span className={`text-sm ${
                booking.assignedCount === booking.guards_count 
                  ? "text-emerald-400" 
                  : "text-amber-400"
              }`}>
                {assignmentProgress} assigned
              </span>
            )}
          </div>
        </div>

        {/* Status & Action */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <BookingStatusBadge status={booking.status} />
          <Link
            href={`/d/agency/bookings/${booking.id}`}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    confirmed: "bg-blue-500/20 text-blue-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-red-500/20 text-red-400",
  };

  const labels: Record<BookingStatus, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// Compact version for dashboard
export function BookingListItem({ booking }: { 
  booking: Booking & { venue?: { name: string } };
}) {
  const startDate = new Date(booking.start);
  
  return (
    <Link
      href={`/d/agency/bookings/${booking.id}`}
      className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-white/[0.03]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-shield-500/20 text-shield-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {booking.venue?.name || "Unknown Venue"}
        </p>
        <p className="text-xs text-zinc-400">
          {startDate.toLocaleDateString("en-GB", { 
            day: "numeric", 
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          })} · {booking.guards_count} guards
        </p>
      </div>
      <BookingStatusBadge status={booking.status} />
    </Link>
  );
}
