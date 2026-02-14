"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CallButton } from "@/components/calling";
import type { AgencyStaffWithPersonnel, AgencyStaffStatus, AgencyStaffRole } from "@/types/database";

interface StaffCardProps {
  staff: AgencyStaffWithPersonnel;
  onMessage?: () => void;
  onRemove?: () => void;
  showCallButton?: boolean;
}

export function StaffCard({ staff, onMessage, onRemove, showCallButton = true }: StaffCardProps) {
  const { personnel } = staff;
  const initials = personnel.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass group rounded-xl p-4 transition-all hover:shadow-glow-sm"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-sm font-semibold text-white">
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/d/agency/staff/${staff.id}`}
              className="font-medium text-white hover:text-shield-400"
            >
              {personnel.display_name}
            </Link>
            <StaffStatusBadge status={staff.status} />
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">
            <StaffRoleBadge role={staff.role} />
            {staff.hourly_rate && (
              <span className="ml-2 text-shield-400">
                £{(staff.hourly_rate / 100).toFixed(2)}/hr
              </span>
            )}
          </p>
          {personnel.certs && personnel.certs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {personnel.certs.slice(0, 3).map((cert) => (
                <span
                  key={cert}
                  className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400"
                >
                  {cert}
                </span>
              ))}
              {personnel.certs.length > 3 && (
                <span className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-500">
                  +{personnel.certs.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {showCallButton && personnel.user_id && (
            <CallButton
              userId={personnel.user_id}
              name={personnel.display_name}
              role="personnel"
              variant="icon"
            />
          )}
          {onMessage && (
            <button
              onClick={onMessage}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              title="Message"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}
          <Link
            href={`/d/agency/staff/${staff.id}`}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            title="View details"
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

export function StaffStatusBadge({ status }: { status: AgencyStaffStatus }) {
  const styles: Record<AgencyStaffStatus, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    active: "bg-emerald-500/20 text-emerald-400",
    inactive: "bg-zinc-500/20 text-zinc-400",
    suspended: "bg-red-500/20 text-red-400",
  };

  const labels: Record<AgencyStaffStatus, string> = {
    pending: "Pending",
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function StaffRoleBadge({ role }: { role: AgencyStaffRole }) {
  const labels: Record<AgencyStaffRole, string> = {
    employee: "Employee",
    contractor: "Contractor",
    manager: "Manager",
  };

  return <span className="text-zinc-500">{labels[role]}</span>;
}

// Compact version for lists
export function StaffListItem({ staff, selected, onSelect }: { 
  staff: AgencyStaffWithPersonnel; 
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { personnel } = staff;
  const initials = personnel.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${
        selected
          ? "bg-shield-500/20 ring-1 ring-shield-500/50"
          : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-shield-500 to-shield-600 text-xs font-semibold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{personnel.display_name}</p>
        <p className="truncate text-xs text-zinc-400">
          {personnel.certs?.slice(0, 2).join(", ")}
        </p>
      </div>
      {selected && (
        <svg className="h-5 w-5 shrink-0 text-shield-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}
