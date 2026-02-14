"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Verification, VerificationDocument, VerificationRequirement } from "@/types/database";
import { DocumentUpload } from "./DocumentUpload";

// Helper to extract file path from Supabase storage URL
function extractFilePath(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    // Extract path after /storage/v1/object/public/verification-documents/ or /storage/v1/object/sign/verification-documents/
    const pathMatch = url.pathname.match(/\/verification-documents\/(.+)$/);
    if (pathMatch) return pathMatch[1];
    
    // Also try extracting from the full pathname
    const fullMatch = url.pathname.match(/verification-documents\/(.+)$/);
    return fullMatch ? fullMatch[1] : null;
  } catch {
    // If URL parsing fails, try to extract from string directly
    const match = fileUrl.match(/verification-documents\/(.+)$/);
    return match ? match[1] : null;
  }
}

interface VerificationDashboardProps {
  ownerType: "personnel" | "agency";
  ownerId: string;
}

export function VerificationDashboard({ ownerType, ownerId }: VerificationDashboardProps) {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [requirements, setRequirements] = useState<VerificationRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [ownerType, ownerId]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Load verification status
      const { data: verificationData, error: verificationError } = await supabase
        .from("verifications")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .single();

      if (verificationError && verificationError.code !== "PGRST116") {
        throw verificationError;
      }

      // Load documents
      const { data: documentsData, error: documentsError } = await supabase
        .from("verification_documents")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (documentsError) throw documentsError;

      // Load requirements
      const { data: requirementsData, error: requirementsError } = await supabase
        .from("verification_requirements")
        .select("*")
        .eq("owner_type", ownerType)
        .order("priority", { ascending: true });

      if (requirementsError) throw requirementsError;

      setVerification(verificationData);
      setDocuments(documentsData || []);
      setRequirements(requirementsData || []);
    } catch (err: any) {
      console.error("Error loading verification data:", err);
      setError(err.message || "Failed to load verification data");
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "text-green-400 bg-green-400/20";
      case "in_review":
        return "text-yellow-400 bg-yellow-400/20";
      case "rejected":
        return "text-red-400 bg-red-400/20";
      case "expired":
        return "text-orange-400 bg-orange-400/20";
      case "suspended":
        return "text-red-400 bg-red-400/20";
      default:
        return "text-zinc-400 bg-zinc-400/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "verified":
        return "Verified";
      case "in_review":
        return "Under Review";
      case "rejected":
        return "Rejected";
      case "expired":
        return "Expired";
      case "suspended":
        return "Suspended";
      default:
        return "Pending";
    }
  };

  const getDocumentForType = (documentType: string) => {
    return documents.find((doc) => doc.document_type === documentType);
  };

  const handleViewDocument = async (document: VerificationDocument) => {
    const supabase = createClient();
    const filePath = extractFilePath(document.file_url);
    
    if (!filePath) {
      window.open(document.file_url, '_blank');
      return;
    }

    // Generate signed URL for private bucket (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from('verification-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error generating signed URL:', error);
      // Fallback to original URL
      window.open(document.file_url, '_blank');
    } else if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-shield-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      {verification && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Verification Status</h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                verification.status
              )}`}
            >
              {getStatusLabel(verification.status)}
            </span>
          </div>

          {verification.rejection_reason && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400 font-medium mb-1">Rejection Reason:</p>
              <p className="text-sm text-red-300">{verification.rejection_reason}</p>
            </div>
          )}

          {/* Verification Checklist */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  verification.identity_verified
                    ? "bg-green-500"
                    : "bg-zinc-700 border border-zinc-600"
                }`}
              >
                {verification.identity_verified && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-400">Identity</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  verification.documents_verified
                    ? "bg-green-500"
                    : "bg-zinc-700 border border-zinc-600"
                }`}
              >
                {verification.documents_verified && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-400">Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  verification.background_checked
                    ? "bg-green-500"
                    : "bg-zinc-700 border border-zinc-600"
                }`}
              >
                {verification.background_checked && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-400">Background</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  verification.insurance_verified
                    ? "bg-green-500"
                    : "bg-zinc-700 border border-zinc-600"
                }`}
              >
                {verification.insurance_verified && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-400">Insurance</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  verification.certifications_verified
                    ? "bg-green-500"
                    : "bg-zinc-700 border border-zinc-600"
                }`}
              >
                {verification.certifications_verified && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-400">Certifications</span>
            </div>
          </div>
        </div>
      )}

      {/* Required Documents */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">Required Documents</h3>
        {requirements.map((requirement) => {
          const document = getDocumentForType(requirement.document_type);
          const isUploaded = !!document;
          const isVerified = document?.status === "verified";

          return (
            <div
              key={requirement.id}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-medium text-white">{requirement.description}</h4>
                    {requirement.is_mandatory && (
                      <span className="px-2 py-0.5 text-xs font-medium text-red-400 bg-red-400/20 rounded">
                        Mandatory
                      </span>
                    )}
                    {isVerified && (
                      <span className="px-2 py-0.5 text-xs font-medium text-green-400 bg-green-400/20 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                  {requirement.help_text && (
                    <p className="text-xs text-zinc-500">{requirement.help_text}</p>
                  )}
                </div>
              </div>

              {isUploaded ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-zinc-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div>
                        <p className="text-sm text-white">{document.document_name}</p>
                        <p className="text-xs text-zinc-500">
                          Status: {getStatusLabel(document.status)}
                          {document.expires_at && ` • Expires: ${new Date(document.expires_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewDocument(document)}
                      className="text-sm text-shield-400 hover:text-shield-300 cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                  {document.rejection_reason && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400">{document.rejection_reason}</p>
                    </div>
                  )}
                </div>
              ) : (
                <DocumentUpload
                  ownerType={ownerType}
                  ownerId={ownerId}
                  documentType={requirement.document_type}
                  documentName={requirement.description || requirement.document_type}
                  onUploadComplete={() => {
                    loadData();
                  }}
                  onError={(err) => {
                    setError(err);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
