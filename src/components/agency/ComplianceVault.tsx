"use client";

import { useState } from "react";

interface StaffDocument {
  id: string;
  staffId: string;
  staffName: string;
  type: "sia_license" | "right_to_work" | "dbs_check" | "training" | "insurance" | "other";
  documentNumber?: string;
  expiryDate?: string;
  status: "valid" | "expiring_soon" | "expired" | "pending";
  uploadedAt: string;
  fileUrl?: string;
}

interface ComplianceVaultProps {
  documents?: StaffDocument[];
  staff?: Array<{
    id: string;
    name: string;
    siaNumber?: string;
    siaExpiry?: string;
    documents: StaffDocument[];
  }>;
}

export function ComplianceVault({ documents = [], staff = [] }: ComplianceVaultProps) {
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "valid": return "bg-emerald-500/20 text-emerald-300";
      case "expiring_soon": return "bg-yellow-500/20 text-yellow-300";
      case "expired": return "bg-red-500/20 text-red-300";
      case "pending": return "bg-blue-500/20 text-blue-300";
      default: return "bg-zinc-500/20 text-zinc-400";
    }
  };

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case "sia_license": return "SIA License";
      case "right_to_work": return "Right to Work";
      case "dbs_check": return "DBS Check";
      case "training": return "Training Cert";
      case "insurance": return "Insurance";
      default: return "Document";
    }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case "sia_license": return "🪪";
      case "right_to_work": return "📋";
      case "dbs_check": return "🔍";
      case "training": return "📜";
      case "insurance": return "🛡️";
      default: return "📄";
    }
  };

  // Calculate compliance summary
  const expiringCount = documents.filter(d => d.status === "expiring_soon").length;
  const expiredCount = documents.filter(d => d.status === "expired").length;
  const validCount = documents.filter(d => d.status === "valid").length;
  const totalStaffWithSIA = staff.filter(s => s.siaNumber).length;

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    if (filter === "expiring" && doc.status !== "expiring_soon") return false;
    if (filter === "expired" && doc.status !== "expired") return false;
    if (searchTerm && !doc.staffName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-white">Compliance Vault</h2>
          <p className="text-sm text-zinc-400">Track staff documents and certifications</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-shield-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Report
        </button>
      </div>

      {/* Compliance Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Valid Documents</span>
            <span className="text-lg">✅</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{validCount}</div>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Expiring Soon</span>
            <span className="text-lg">⚠️</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-yellow-400">{expiringCount}</div>
          <div className="mt-1 text-xs text-zinc-500">Within 30 days</div>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Expired</span>
            <span className="text-lg">❌</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-400">{expiredCount}</div>
          <div className="mt-1 text-xs text-zinc-500">Action required</div>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">SIA Verified</span>
            <span className="text-lg">🪪</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{totalStaffWithSIA}</div>
          <div className="mt-1 text-xs text-zinc-500">of {staff.length} staff</div>
        </div>
      </div>

      {/* Alerts */}
      {(expiringCount > 0 || expiredCount > 0) && (
        <div className="space-y-2">
          {expiredCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <span className="text-xl">🚨</span>
              <div className="flex-1">
                <div className="font-medium text-red-300">{expiredCount} document(s) have expired</div>
                <div className="text-sm text-red-400/80">These staff members cannot work until documents are renewed</div>
              </div>
              <button 
                onClick={() => setFilter("expired")}
                className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30"
              >
                View All
              </button>
            </div>
          )}
          
          {expiringCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <span className="text-xl">⏰</span>
              <div className="flex-1">
                <div className="font-medium text-yellow-300">{expiringCount} document(s) expiring within 30 days</div>
                <div className="text-sm text-yellow-400/80">Remind staff to renew their documents</div>
              </div>
              <button 
                onClick={() => setFilter("expiring")}
                className="rounded-md bg-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-300 transition hover:bg-yellow-500/30"
              >
                View All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["all", "expiring", "expired"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                filter === f
                  ? "bg-shield-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All Documents" : f === "expiring" ? "Expiring Soon" : "Expired"}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 sm:w-64"
          />
        </div>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <span className="text-4xl">📁</span>
          <h3 className="mt-4 font-medium text-white">No documents found</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {documents.length === 0
              ? "Add staff and their documents to track compliance"
              : "No documents match your current filters"}
          </p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/[0.06] bg-zinc-800/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Staff Member</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Expiry</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="transition hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="text-sm font-medium text-white">{doc.staffName}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{getDocTypeIcon(doc.type)}</span>
                        <span className="text-sm text-zinc-300">{getDocTypeLabel(doc.type)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-sm text-zinc-400">{doc.documentNumber || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="text-sm text-zinc-300">
                        {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString("en-GB") : "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {doc.status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button className="text-sm text-shield-400 transition hover:text-shield-300">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
