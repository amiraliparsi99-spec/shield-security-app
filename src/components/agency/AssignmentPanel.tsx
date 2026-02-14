"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgencyStaffWithPersonnel, BookingAssignmentStatus } from "@/types/database";
import { StaffListItem } from "./StaffCard";

interface AssignmentPanelProps {
  bookingId: string;
  guardsNeeded: number;
  assignedStaff: Array<{
    id: string;
    status: BookingAssignmentStatus;
    staff: AgencyStaffWithPersonnel;
  }>;
  availableStaff: AgencyStaffWithPersonnel[];
  suggestedStaff?: AgencyStaffWithPersonnel[];
  onAssign: (staffIds: string[]) => Promise<void>;
  onUnassign: (assignmentId: string) => Promise<void>;
  onUpdateStatus: (assignmentId: string, status: BookingAssignmentStatus) => Promise<void>;
  isLoading?: boolean;
}

export function AssignmentPanel({
  bookingId,
  guardsNeeded,
  assignedStaff,
  availableStaff,
  suggestedStaff,
  onAssign,
  onUnassign,
  onUpdateStatus,
  isLoading,
}: AssignmentPanelProps) {
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const assignedCount = assignedStaff.length;
  const remaining = guardsNeeded - assignedCount;

  const handleToggleSelect = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const handleAssign = async () => {
    if (selectedStaff.length === 0) return;
    setIsAssigning(true);
    try {
      await onAssign(selectedStaff);
      setSelectedStaff([]);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-medium text-white">Staff Assignment</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {assignedCount} of {guardsNeeded} guards assigned
            {remaining > 0 && (
              <span className="ml-2 text-amber-400">({remaining} needed)</span>
            )}
          </p>
        </div>
        {suggestedStaff && suggestedStaff.length > 0 && (
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="inline-flex items-center gap-2 rounded-lg bg-shield-500/20 px-3 py-2 text-sm font-medium text-shield-300 transition hover:bg-shield-500/30"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Smart Suggest
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={`h-full ${
            assignedCount >= guardsNeeded ? "bg-emerald-500" : "bg-shield-500"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min((assignedCount / guardsNeeded) * 100, 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Assigned Staff */}
      {assignedStaff.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-medium text-zinc-400">Assigned Staff</h4>
          <div className="space-y-2">
            {assignedStaff.map((assignment) => (
              <AssignedStaffItem
                key={assignment.id}
                assignment={assignment}
                onUnassign={() => onUnassign(assignment.id)}
                onUpdateStatus={(status) => onUpdateStatus(assignment.id, status)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Suggestions Panel */}
      <AnimatePresence>
        {showSuggestions && suggestedStaff && suggestedStaff.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass overflow-hidden rounded-xl"
          >
            <div className="border-b border-white/[0.06] p-4">
              <h4 className="text-sm font-medium text-white">Suggested Staff</h4>
              <p className="mt-1 text-xs text-zinc-400">
                Based on availability, certifications, and past performance
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {suggestedStaff.map((staff) => (
                <StaffListItem
                  key={staff.id}
                  staff={staff}
                  selected={selectedStaff.includes(staff.id)}
                  onSelect={() => handleToggleSelect(staff.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Available Staff */}
      {remaining > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-medium text-zinc-400">Available Staff</h4>
          {availableStaff.length === 0 ? (
            <p className="rounded-lg bg-white/5 p-4 text-center text-sm text-zinc-500">
              No available staff. Add more personnel to your team.
            </p>
          ) : (
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl bg-white/[0.02] p-2">
              {availableStaff.map((staff) => (
                <StaffListItem
                  key={staff.id}
                  staff={staff}
                  selected={selectedStaff.includes(staff.id)}
                  onSelect={() => handleToggleSelect(staff.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign Button */}
      {selectedStaff.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl bg-shield-500/20 p-4"
        >
          <span className="text-sm text-shield-300">
            {selectedStaff.length} staff selected
          </span>
          <button
            onClick={handleAssign}
            disabled={isAssigning || isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400 disabled:opacity-50"
          >
            {isAssigning ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Assigning...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Assign Selected
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}

function AssignedStaffItem({
  assignment,
  onUnassign,
  onUpdateStatus,
}: {
  assignment: {
    id: string;
    status: BookingAssignmentStatus;
    staff: AgencyStaffWithPersonnel;
  };
  onUnassign: () => void;
  onUpdateStatus: (status: BookingAssignmentStatus) => void;
}) {
  const { personnel } = assignment.staff;
  const initials = personnel.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const statusColors: Record<BookingAssignmentStatus, string> = {
    assigned: "bg-blue-500/20 text-blue-400",
    confirmed: "bg-emerald-500/20 text-emerald-400",
    declined: "bg-red-500/20 text-red-400",
    completed: "bg-purple-500/20 text-purple-400",
    no_show: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-shield-500 to-shield-600 text-xs font-semibold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{personnel.display_name}</p>
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusColors[assignment.status]}`}>
          {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {assignment.status === "assigned" && (
          <button
            onClick={() => onUpdateStatus("confirmed")}
            className="rounded p-1.5 text-zinc-400 transition hover:bg-emerald-500/20 hover:text-emerald-400"
            title="Mark confirmed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        <button
          onClick={onUnassign}
          className="rounded p-1.5 text-zinc-400 transition hover:bg-red-500/20 hover:text-red-400"
          title="Remove assignment"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
