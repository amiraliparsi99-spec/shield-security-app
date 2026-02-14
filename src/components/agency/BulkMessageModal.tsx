"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StaffListItem } from "./StaffCard";
import type { AgencyStaffWithPersonnel } from "@/types/database";

interface BulkMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: AgencyStaffWithPersonnel[];
  onSend: (staffIds: string[], message: string) => Promise<void>;
}

export function BulkMessageModal({ isOpen, onClose, staff, onSend }: BulkMessageModalProps) {
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleToggleStaff = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStaff.length === staff.length) {
      setSelectedStaff([]);
    } else {
      setSelectedStaff(staff.map((s) => s.id));
    }
  };

  const handleSend = async () => {
    if (selectedStaff.length === 0 || !message.trim()) return;
    
    setIsSending(true);
    try {
      await onSend(selectedStaff, message.trim());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedStaff([]);
        setMessage("");
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error sending messages:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setSelectedStaff([]);
      setMessage("");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="glass overflow-hidden rounded-2xl shadow-2xl">
              {success ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-semibold text-white">
                    Messages Sent!
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Sent to {selectedStaff.length} staff member{selectedStaff.length !== 1 ? "s" : ""}
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
                    <div>
                      <h2 className="font-display text-lg font-medium text-white">
                        Send Bulk Message
                      </h2>
                      <p className="text-sm text-zinc-400">
                        Message multiple staff members at once
                      </p>
                    </div>
                    <button
                      onClick={handleClose}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Staff Selection */}
                  <div className="max-h-64 overflow-y-auto border-b border-white/[0.06] p-2">
                    <div className="mb-2 flex items-center justify-between px-2">
                      <span className="text-sm text-zinc-400">
                        {selectedStaff.length} selected
                      </span>
                      <button
                        onClick={handleSelectAll}
                        className="text-sm text-shield-400 hover:text-shield-300"
                      >
                        {selectedStaff.length === staff.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    {staff.length === 0 ? (
                      <p className="py-8 text-center text-sm text-zinc-500">
                        No staff members available
                      </p>
                    ) : (
                      staff.map((staffMember) => (
                        <StaffListItem
                          key={staffMember.id}
                          staff={staffMember}
                          selected={selectedStaff.includes(staffMember.id)}
                          onSelect={() => handleToggleStaff(staffMember.id)}
                        />
                      ))
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="p-4">
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      This will create individual conversations with each selected staff member
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 border-t border-white/[0.06] p-4">
                    <button
                      onClick={handleClose}
                      className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={isSending || selectedStaff.length === 0 || !message.trim()}
                      className="flex-1 rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400 disabled:opacity-50"
                    >
                      {isSending ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </span>
                      ) : (
                        `Send to ${selectedStaff.length} Staff`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
