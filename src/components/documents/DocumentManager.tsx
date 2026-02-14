"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Document {
  id: string;
  document_type: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  reference_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  verification_status: string;
  created_at: string;
}

const DOCUMENT_TYPES = [
  { value: "sia_license", label: "SIA License", icon: "🛡️" },
  { value: "sia_cctv", label: "SIA CCTV License", icon: "📹" },
  { value: "sia_door", label: "SIA Door Supervisor", icon: "🚪" },
  { value: "sia_cp", label: "SIA Close Protection", icon: "🔒" },
  { value: "dbs_check", label: "DBS Check", icon: "✅" },
  { value: "first_aid", label: "First Aid Certificate", icon: "🏥" },
  { value: "fire_safety", label: "Fire Safety Certificate", icon: "🔥" },
  { value: "passport", label: "Passport", icon: "🛂" },
  { value: "driving_license", label: "Driving License", icon: "🚗" },
  { value: "right_to_work", label: "Right to Work", icon: "📋" },
  { value: "insurance", label: "Insurance", icon: "🔐" },
  { value: "training_cert", label: "Training Certificate", icon: "🎓" },
  { value: "other", label: "Other Document", icon: "📄" },
];

interface Props {
  userId: string;
}

export function DocumentManager({ userId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    reference_number: "",
    issue_date: "",
    expiry_date: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadDocuments();
  }, [userId]);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadForm.title) {
        setUploadForm((prev) => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, ""),
        }));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType) return;

    setUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(fileName);

      // Save document record
      const { error: insertError } = await supabase.from("user_documents").insert({
        user_id: userId,
        document_type: selectedType,
        title: uploadForm.title,
        description: uploadForm.description || null,
        file_url: publicUrl,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        reference_number: uploadForm.reference_number || null,
        issue_date: uploadForm.issue_date || null,
        expiry_date: uploadForm.expiry_date || null,
      });

      if (insertError) throw insertError;

      // Reset form
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedType("");
      setUploadForm({
        title: "",
        description: "",
        reference_number: "",
        issue_date: "",
        expiry_date: "",
      });

      await loadDocuments();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      // Delete from storage
      const path = doc.file_url.split("/documents/")[1];
      if (path) {
        await supabase.storage.from("documents").remove([path]);
      }

      // Delete record
      await supabase.from("user_documents").delete().eq("id", doc.id);

      await loadDocuments();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-green-500/20 text-green-400";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400";
      case "rejected":
        return "bg-red-500/20 text-red-400";
      case "expired":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-dark-500/20 text-dark-300";
    }
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow && expiry > new Date();
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const getDocTypeInfo = (type: string) => {
    return (
      DOCUMENT_TYPES.find((t) => t.value === type) || {
        label: type,
        icon: "📄",
      }
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-dark-600 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-dark-600 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Documents</h2>
          <p className="text-dark-400 text-sm">
            Manage your licenses, certifications, and ID documents
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
        >
          + Upload Document
        </button>
      </div>

      {/* Expiring Soon Alert */}
      {documents.some(
        (d) => isExpiringSoon(d.expiry_date) || isExpired(d.expiry_date)
      ) && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400">
            <span>⚠️</span>
            <span className="font-medium">Document Attention Required</span>
          </div>
          <p className="text-sm text-dark-300 mt-1">
            Some documents are expiring soon or have expired. Please renew them
            to maintain your verified status.
          </p>
        </div>
      )}

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-12 bg-dark-800 border border-dark-600 rounded-xl">
          <span className="text-5xl mb-4 block">📁</span>
          <h3 className="text-lg font-medium text-white mb-2">
            No documents yet
          </h3>
          <p className="text-dark-400 mb-6">
            Upload your SIA license, certifications, and ID documents
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
          >
            Upload Your First Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const typeInfo = getDocTypeInfo(doc.document_type);
            const expired = isExpired(doc.expiry_date);
            const expiringSoon = isExpiringSoon(doc.expiry_date);

            return (
              <div
                key={doc.id}
                className={`p-4 bg-dark-800 border rounded-xl hover:border-dark-500 transition-colors ${
                  expired
                    ? "border-red-500/50"
                    : expiringSoon
                    ? "border-yellow-500/50"
                    : "border-dark-600"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                      <h4 className="font-medium text-white truncate max-w-[150px]">
                        {doc.title}
                      </h4>
                      <p className="text-xs text-dark-400">{typeInfo.label}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                      expired ? "expired" : doc.verification_status
                    )}`}
                  >
                    {expired ? "Expired" : doc.verification_status}
                  </span>
                </div>

                {doc.reference_number && (
                  <p className="text-sm text-dark-300 mb-2">
                    Ref: {doc.reference_number}
                  </p>
                )}

                <div className="text-xs text-dark-400 space-y-1">
                  {doc.issue_date && (
                    <p>
                      Issued:{" "}
                      {new Date(doc.issue_date).toLocaleDateString("en-GB")}
                    </p>
                  )}
                  {doc.expiry_date && (
                    <p
                      className={
                        expired
                          ? "text-red-400"
                          : expiringSoon
                          ? "text-yellow-400"
                          : ""
                      }
                    >
                      Expires:{" "}
                      {new Date(doc.expiry_date).toLocaleDateString("en-GB")}
                      {expiringSoon && " (Soon)"}
                    </p>
                  )}
                  <p>{formatFileSize(doc.file_size)}</p>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-dark-700">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm text-center transition-colors"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-600">
              <h3 className="text-lg font-semibold text-white">
                Upload Document
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Document Type */}
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Document Type *
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
                >
                  <option value="">Select type...</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  File *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center cursor-pointer hover:border-accent transition-colors"
                >
                  {selectedFile ? (
                    <div>
                      <span className="text-2xl">📄</span>
                      <p className="text-white mt-2">{selectedFile.name}</p>
                      <p className="text-sm text-dark-400">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-3xl">📤</span>
                      <p className="text-dark-300 mt-2">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-dark-500">
                        PDF, JPG, PNG up to 10MB
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g. SIA Door Supervisor License"
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
                />
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Reference/License Number
                </label>
                <input
                  type="text"
                  value={uploadForm.reference_number}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      reference_number: e.target.value,
                    }))
                  }
                  placeholder="e.g. 1234-5678-9012-3456"
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-300 mb-2">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={uploadForm.issue_date}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        issue_date: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-300 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={uploadForm.expiry_date}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        expiry_date: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Additional notes about this document..."
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-dark-600 flex gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedType || !uploadForm.title || uploading}
                className="flex-1 px-4 py-3 bg-accent hover:bg-accent-dark disabled:bg-accent/50 text-white rounded-lg font-medium transition-colors"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
