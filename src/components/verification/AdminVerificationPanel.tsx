"use client";

import { useEffect, useState } from "react";
import type { VerificationDocument } from "@/types/database";

type VerificationWithDocs = {
  id: string;
  owner_type: string;
  owner_id: string;
  status: string;
  created_at: string;
  documents: VerificationDocument[];
  guardName: string;
  siaLicenseNumber: string | null;
  siaExpiryDate: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function AdminVerificationPanel() {
  const [verifications, setVerifications] = useState<VerificationWithDocs[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadVerifications();
  }, []);

  async function loadVerifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/verifications");
      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to load verifications:", res.status, text);
        return;
      }
      const data = await res.json();
      setVerifications(data);
    } catch (err) {
      console.error("Error loading verifications:", err);
    } finally {
      setLoading(false);
    }
  }

  async function callAction(body: Record<string, unknown>) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Action failed: " + (err.error || "Unknown error"));
        return;
      }
      await loadVerifications();
    } catch (err) {
      console.error("Action error:", err);
      alert("Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function approveDocument(documentId: string) {
    const v = verifications.find((v) => v.documents.some((d) => d.id === documentId));
    await callAction({ action: "approve_document", documentId, verificationId: v?.id });
  }

  async function rejectDocument(documentId: string, reason: string) {
    await callAction({ action: "reject_document", documentId, reason });
  }

  async function approveAll(verificationId: string) {
    await callAction({ action: "approve_all", verificationId });
    setSelectedVerification(null);
    setReviewNotes("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-shield-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selected = verifications.find((v) => v.id === selectedVerification);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Verifications ({verifications.length})
        </h2>
        {verifications.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-400">No verifications with documents found</p>
          </div>
        ) : (
          verifications.map((verification) => {
            const pendingDocs = verification.documents.filter(
              (d) => d.status === "pending" || d.status === "in_review"
            );
            return (
              <div
                key={verification.id}
                className={`bg-zinc-900/50 border rounded-xl p-4 cursor-pointer transition ${
                  selectedVerification === verification.id
                    ? "border-shield-500 bg-shield-500/10"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
                onClick={() => setSelectedVerification(verification.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {verification.guardName}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      verification.status === "verified"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {verification.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500 capitalize">{verification.owner_type}</p>
                  <span className="text-xs text-zinc-500">
                    {verification.documents.length} doc
                    {verification.documents.length !== 1 ? "s" : ""}
                    {pendingDocs.length > 0 && ` · ${pendingDocs.length} to review`}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Submitted: {new Date(verification.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Review Panel */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        {selected ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Review {selected.owner_type} Verification
              </h3>

              {/* Guard profile */}
              {selected.owner_type === "personnel" && (
                <div className="flex items-center gap-4 p-4 mb-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                  {selected.avatarUrl ? (
                    <img
                      src={selected.avatarUrl}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover border border-zinc-600"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-xl font-semibold">
                      {selected.guardName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{selected.guardName}</p>
                    {selected.email && (
                      <p className="text-xs text-zinc-400">{selected.email}</p>
                    )}
                  </div>
                </div>
              )}

              {/* SIA License details */}
              {selected.owner_type === "personnel" &&
                (selected.siaLicenseNumber || selected.siaExpiryDate) && (
                  <div className="p-4 mb-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-white mb-3">
                      SIA License Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selected.siaLicenseNumber && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">License Number</p>
                          <p className="text-sm font-mono text-white bg-zinc-900 rounded px-3 py-2 border border-zinc-600">
                            {selected.siaLicenseNumber}
                          </p>
                        </div>
                      )}
                      {selected.siaExpiryDate && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Expiry Date</p>
                          <p className="text-sm font-mono text-white bg-zinc-900 rounded px-3 py-2 border border-zinc-600">
                            {new Date(selected.siaExpiryDate).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Documents */}
              <div className="space-y-4 mb-6">
                {selected.documents.map((document) => {
                  const isImage =
                    document.mime_type?.startsWith("image/") ||
                    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(document.file_url ?? "");
                  return (
                    <div
                      key={document.id}
                      className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {document.document_name}
                          </p>
                          <p className="text-xs text-zinc-500 capitalize">
                            {document.document_type}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            document.status === "verified"
                              ? "bg-green-500/20 text-green-400"
                              : document.status === "rejected"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {document.status}
                        </span>
                      </div>
                      {isImage && document.file_url && (
                        <div className="my-3 rounded-lg overflow-hidden border border-zinc-600 bg-zinc-900 max-h-64">
                          <img
                            src={document.file_url}
                            alt={document.document_name}
                            className="w-full h-auto object-contain max-h-64"
                          />
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => window.open(document.file_url ?? "", "_blank")}
                          className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-center text-white transition"
                        >
                          {isImage ? "Open in new tab" : "View Document"}
                        </button>
                        {document.status !== "verified" && (
                          <>
                            <button
                              disabled={actionLoading}
                              onClick={() => approveDocument(document.id)}
                              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm text-white transition"
                            >
                              Approve
                            </button>
                            <button
                              disabled={actionLoading}
                              onClick={() => {
                                const reason = prompt("Rejection reason:");
                                if (reason) rejectDocument(document.id, reason);
                              }}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm text-white transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                      {document.rejection_reason && (
                        <p className="text-xs text-red-400 mt-2">
                          {document.rejection_reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Review Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-shield-500"
                  rows={3}
                  placeholder="Internal notes (not visible to user)"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  disabled={actionLoading}
                  onClick={() => approveAll(selected.id)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm font-medium text-white transition"
                >
                  {actionLoading ? "Processing..." : "Approve All"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-400">Select a verification to review</p>
          </div>
        )}
      </div>
    </div>
  );
}
