"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Verification, VerificationDocument } from "@/types/database";

export function AdminVerificationPanel() {
  const [pendingVerifications, setPendingVerifications] = useState<
    (Verification & { documents: VerificationDocument[] })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    loadPendingVerifications();
  }, []);

  async function loadPendingVerifications() {
    setLoading(true);
    try {
      const supabase = createClient();

      // Load verifications that need review
      const { data: verifications, error } = await supabase
        .from("verifications")
        .select("*")
        .in("status", ["pending", "in_review"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Load documents for each verification
      const verificationsWithDocs = await Promise.all(
        (verifications || []).map(async (verification) => {
          const { data: documents } = await supabase
            .from("verification_documents")
            .select("*")
            .eq("owner_type", verification.owner_type)
            .eq("owner_id", verification.owner_id);

          return {
            ...verification,
            documents: documents || [],
          };
        })
      );

      setPendingVerifications(verificationsWithDocs);
    } catch (err: any) {
      console.error("Error loading verifications:", err);
    } finally {
      setLoading(false);
    }
  }

  async function approveVerification(verificationId: string) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Update verification status
      const { error } = await supabase
        .from("verifications")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          last_reviewed_at: new Date().toISOString(),
          admin_notes: reviewNotes || null,
        })
        .eq("id", verificationId);

      if (error) throw error;

      // Approve all verified documents
      const verification = pendingVerifications.find((v) => v.id === verificationId);
      if (verification) {
        const verifiedDocs = verification.documents.filter(
          (doc) => doc.status === "in_review" || doc.status === "pending"
        );

        for (const doc of verifiedDocs) {
          await supabase
            .from("verification_documents")
            .update({
              status: "verified",
              verified_at: new Date().toISOString(),
              verified_by: user.id,
            })
            .eq("id", doc.id);
        }
      }

      setReviewNotes("");
      setSelectedVerification(null);
      loadPendingVerifications();
    } catch (err: any) {
      console.error("Error approving verification:", err);
      alert("Failed to approve verification: " + err.message);
    }
  }

  async function rejectVerification(verificationId: string) {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("verifications")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          verified_by: user.id,
          last_reviewed_at: new Date().toISOString(),
          admin_notes: reviewNotes || null,
        })
        .eq("id", verificationId);

      if (error) throw error;

      setRejectionReason("");
      setReviewNotes("");
      setSelectedVerification(null);
      loadPendingVerifications();
    } catch (err: any) {
      console.error("Error rejecting verification:", err);
      alert("Failed to reject verification: " + err.message);
    }
  }

  async function approveDocument(documentId: string) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("verification_documents")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", documentId);

      if (error) throw error;

      loadPendingVerifications();
    } catch (err: any) {
      console.error("Error approving document:", err);
      alert("Failed to approve document: " + err.message);
    }
  }

  async function rejectDocument(documentId: string, reason: string) {
    if (!reason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("verification_documents")
        .update({
          status: "rejected",
          rejection_reason: reason,
          verified_by: user.id,
        })
        .eq("id", documentId);

      if (error) throw error;

      loadPendingVerifications();
    } catch (err: any) {
      console.error("Error rejecting document:", err);
      alert("Failed to reject document: " + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-shield-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selected = pendingVerifications.find((v) => v.id === selectedVerification);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* List of Pending Verifications */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Pending Verifications ({pendingVerifications.length})
        </h2>
        {pendingVerifications.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-400">No pending verifications</p>
          </div>
        ) : (
          pendingVerifications.map((verification) => (
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
                <span className="text-sm font-medium text-white capitalize">
                  {verification.owner_type}
                </span>
                <span className="text-xs text-zinc-500">
                  {verification.documents.length} document{verification.documents.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Submitted: {new Date(verification.created_at).toLocaleDateString()}
              </p>
            </div>
          ))
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

              {/* Documents */}
              <div className="space-y-4 mb-6">
                {selected.documents.map((document) => (
                  <div
                    key={document.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{document.document_name}</p>
                        <p className="text-xs text-zinc-500 capitalize">{document.document_type}</p>
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
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={async () => {
                          const supabase = createClient();
                          // Extract file path from stored URL
                          const url = new URL(document.file_url);
                          const filePath = url.pathname.replace('/storage/v1/object/public/verification-documents/', '').replace('/storage/v1/object/sign/verification-documents/', '');
                          
                          // Generate signed URL for private bucket
                          const { data, error } = await supabase.storage
                            .from('verification-documents')
                            .createSignedUrl(filePath, 3600);
                          
                          if (error) {
                            console.error('Error generating signed URL:', error);
                            alert('Failed to generate document URL. Please try again.');
                          } else if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-center text-white transition"
                      >
                        View Document
                      </button>
                      {document.status !== "verified" && (
                        <>
                          <button
                            onClick={() => approveDocument(document.id)}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt("Rejection reason:");
                              if (reason) rejectDocument(document.id, reason);
                            }}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                    {document.rejection_reason && (
                      <p className="text-xs text-red-400 mt-2">{document.rejection_reason}</p>
                    )}
                  </div>
                ))}
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
                  onClick={() => approveVerification(selected.id)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium text-white transition"
                >
                  Approve All
                </button>
                <button
                  onClick={() => {
                    const reason = prompt("Rejection reason (visible to user):");
                    if (reason) {
                      setRejectionReason(reason);
                      rejectVerification(selected.id);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium text-white transition"
                >
                  Reject
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
