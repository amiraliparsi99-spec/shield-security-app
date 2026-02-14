"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Document = {
  id: string;
  type: "sia" | "dbs" | "training" | "insurance" | "id" | "other";
  name: string;
  status: "verified" | "pending" | "expired" | "expiring_soon";
  uploadDate: string;
  expiryDate?: string;
  verifiedDate?: string;
  fileUrl?: string;
};

const mockDocuments: Document[] = [
  {
    id: "1",
    type: "sia",
    name: "SIA Door Supervisor License",
    status: "verified",
    uploadDate: "2025-08-15",
    expiryDate: "2028-08-15",
    verifiedDate: "2025-08-16",
  },
  {
    id: "2",
    type: "dbs",
    name: "DBS Enhanced Certificate",
    status: "verified",
    uploadDate: "2025-06-10",
    verifiedDate: "2025-06-12",
  },
  {
    id: "3",
    type: "training",
    name: "First Aid Certificate",
    status: "expiring_soon",
    uploadDate: "2023-02-20",
    expiryDate: "2026-02-20",
  },
  {
    id: "4",
    type: "training",
    name: "Conflict Management",
    status: "verified",
    uploadDate: "2025-03-15",
    expiryDate: "2027-03-15",
    verifiedDate: "2025-03-16",
  },
  {
    id: "5",
    type: "id",
    name: "Passport",
    status: "verified",
    uploadDate: "2025-01-10",
    expiryDate: "2030-01-10",
    verifiedDate: "2025-01-11",
  },
];

const documentTypes = [
  { value: "sia", label: "SIA License", icon: "🛡️" },
  { value: "dbs", label: "DBS Certificate", icon: "📋" },
  { value: "training", label: "Training Certificate", icon: "🎓" },
  { value: "insurance", label: "Insurance", icon: "📄" },
  { value: "id", label: "Photo ID", icon: "🪪" },
  { value: "other", label: "Other", icon: "📁" },
];

export function DocumentVault() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [filter, setFilter] = useState<"all" | Document["type"]>("all");
  const [showUpload, setShowUpload] = useState(false);

  const filteredDocs = documents.filter(d => filter === "all" || d.type === filter);

  const verifiedCount = documents.filter(d => d.status === "verified").length;
  const expiringCount = documents.filter(d => d.status === "expiring_soon").length;
  const expiredCount = documents.filter(d => d.status === "expired").length;

  const getStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "verified":
        return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">✓ Verified</span>;
      case "pending":
        return <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">⏳ Pending</span>;
      case "expired":
        return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">❌ Expired</span>;
      case "expiring_soon":
        return <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">⚠️ Expiring Soon</span>;
    }
  };

  const getDocIcon = (type: Document["type"]) => {
    return documentTypes.find(d => d.value === type)?.icon || "📄";
  };

  const daysUntilExpiry = (expiryDate: string) => {
    const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Document Vault</h2>
          <p className="text-sm text-zinc-400">Store and share your credentials securely</p>
        </div>
        <motion.button
          onClick={() => setShowUpload(true)}
          className="bg-shield-500 hover:bg-shield-600 text-white px-4 py-2 rounded-xl font-medium transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + Upload Document
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Verified</p>
          <p className="text-2xl font-bold text-emerald-400">{verifiedCount}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Expiring Soon</p>
          <p className="text-2xl font-bold text-orange-400">{expiringCount}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Expired</p>
          <p className="text-2xl font-bold text-red-400">{expiredCount}</p>
        </div>
      </div>

      {/* Expiry Alert */}
      {expiringCount > 0 && (
        <div className="glass rounded-xl p-4 border border-orange-500/30 bg-orange-500/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-white">{expiringCount} document{expiringCount > 1 ? "s" : ""} expiring soon</p>
              <p className="text-sm text-zinc-400">Renew before expiry to maintain verified status</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
            filter === "all" ? "bg-shield-500 text-white" : "glass text-zinc-400 hover:text-white"
          }`}
        >
          All Documents
        </button>
        {documentTypes.map(type => (
          <button
            key={type.value}
            onClick={() => setFilter(type.value as Document["type"])}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              filter === type.value ? "bg-shield-500 text-white" : "glass text-zinc-400 hover:text-white"
            }`}
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Upload Document</h3>
            <button onClick={() => setShowUpload(false)} className="text-zinc-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Document Type</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition">
                {documentTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Document Name</label>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                placeholder="e.g. SIA Door Supervisor License"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Expiry Date (if applicable)</label>
              <input
                type="date"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              />
            </div>

            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-shield-500/50 transition cursor-pointer">
              <svg className="w-12 h-12 mx-auto text-zinc-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-white font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-zinc-500 mt-1">PDF, JPG, PNG up to 10MB</p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-zinc-400 hover:text-white transition">
                Cancel
              </button>
              <motion.button
                className="bg-shield-500 hover:bg-shield-600 text-white px-6 py-2 rounded-xl font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Upload Document
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Documents List */}
      <div className="space-y-3">
        {filteredDocs.map(doc => (
          <motion.div
            key={doc.id}
            className={`glass rounded-xl p-4 ${
              doc.status === "expiring_soon" ? "border border-orange-500/30" :
              doc.status === "expired" ? "border border-red-500/30" : ""
            }`}
            whileHover={{ scale: 1.005 }}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                doc.status === "verified" ? "bg-emerald-500/20" :
                doc.status === "expiring_soon" ? "bg-orange-500/20" :
                doc.status === "expired" ? "bg-red-500/20" : "bg-white/10"
              }`}>
                {getDocIcon(doc.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-white">{doc.name}</h3>
                  {getStatusBadge(doc.status)}
                </div>
                <p className="text-sm text-zinc-400">
                  Uploaded {new Date(doc.uploadDate).toLocaleDateString("en-GB")}
                  {doc.expiryDate && (
                    <>
                      {" • "}
                      <span className={doc.status === "expiring_soon" || doc.status === "expired" ? "text-orange-400" : ""}>
                        Expires {new Date(doc.expiryDate).toLocaleDateString("en-GB")}
                        {doc.status === "expiring_soon" && ` (${daysUntilExpiry(doc.expiryDate)} days)`}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 glass rounded-lg text-zinc-400 hover:text-white transition" title="View">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button className="p-2 glass rounded-lg text-zinc-400 hover:text-white transition" title="Share">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button className="p-2 glass rounded-lg text-zinc-400 hover:text-white transition" title="Download">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Share */}
      <div className="glass rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3">Quick Share</h3>
        <p className="text-sm text-zinc-400 mb-4">Generate a secure link to share your verified documents with employers</p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value="https://shield.app/verify/abc123..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
          />
          <motion.button
            className="bg-shield-500 hover:bg-shield-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Copy Link
          </motion.button>
        </div>
      </div>
    </div>
  );
}
