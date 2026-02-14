"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type InvoiceLineItem = {
  id: string;
  description: string;
  date: string;
  staffName: string;
  hours: number;
  rate: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatRate: number;
  vat: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  issueDate: string;
  dueDate: string;
  paidDate?: string;
};

const mockInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-2026-001",
    clientName: "The Grand Club",
    clientEmail: "accounts@grandclub.com",
    clientAddress: "123 Broad Street, Birmingham, B1 2AB",
    lineItems: [
      { id: "1", description: "Door Security - NYE Event", date: "2025-12-31", staffName: "Marcus Johnson", hours: 8, rate: 18 },
      { id: "2", description: "Door Security - NYE Event", date: "2025-12-31", staffName: "David Chen", hours: 8, rate: 18 },
      { id: "3", description: "VIP Security - NYE Event", date: "2025-12-31", staffName: "James Wilson", hours: 8, rate: 22 },
    ],
    subtotal: 464,
    vatRate: 20,
    vat: 92.80,
    total: 556.80,
    status: "paid",
    issueDate: "2026-01-01",
    dueDate: "2026-01-15",
    paidDate: "2026-01-10",
  },
  {
    id: "2",
    invoiceNumber: "INV-2026-002",
    clientName: "Birmingham Arena",
    clientEmail: "finance@bhmarena.co.uk",
    clientAddress: "King Edwards Road, Birmingham, B1 2AA",
    lineItems: [
      { id: "1", description: "Event Security - Concert", date: "2026-01-18", staffName: "Marcus Johnson", hours: 6, rate: 16 },
      { id: "2", description: "Event Security - Concert", date: "2026-01-18", staffName: "Sarah Williams", hours: 6, rate: 16 },
      { id: "3", description: "Event Security - Concert", date: "2026-01-18", staffName: "Emma Thompson", hours: 6, rate: 16 },
      { id: "4", description: "Backstage Security - Concert", date: "2026-01-18", staffName: "David Chen", hours: 8, rate: 20 },
    ],
    subtotal: 448,
    vatRate: 20,
    vat: 89.60,
    total: 537.60,
    status: "sent",
    issueDate: "2026-01-19",
    dueDate: "2026-02-02",
  },
  {
    id: "3",
    invoiceNumber: "INV-2026-003",
    clientName: "Mailbox Tower",
    clientEmail: "building@mailboxtower.com",
    clientAddress: "The Mailbox, Birmingham, B1 1RF",
    lineItems: [
      { id: "1", description: "Corporate Security - Week 4", date: "2026-01-20", staffName: "Sarah Williams", hours: 40, rate: 15 },
      { id: "2", description: "Corporate Security - Week 4", date: "2026-01-20", staffName: "Emma Thompson", hours: 40, rate: 15 },
    ],
    subtotal: 1200,
    vatRate: 20,
    vat: 240,
    total: 1440,
    status: "overdue",
    issueDate: "2026-01-06",
    dueDate: "2026-01-20",
  },
];

// Mock completed shifts that can be turned into invoices
const mockCompletedShifts = [
  { id: "s1", venue: "Pryzm", date: "2026-01-25", staff: "Marcus Johnson", hours: 6, rate: 17 },
  { id: "s2", venue: "Pryzm", date: "2026-01-25", staff: "David Chen", hours: 6, rate: 17 },
  { id: "s3", venue: "The Grand Club", date: "2026-01-26", staff: "James Wilson", hours: 7, rate: 18 },
];

export function InvoiceGenerator() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [completedShifts] = useState(mockCompletedShifts);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);

  const getStatusColor = (status: Invoice["status"]) => {
    switch (status) {
      case "draft": return "bg-zinc-500/20 text-zinc-400";
      case "sent": return "bg-blue-500/20 text-blue-400";
      case "paid": return "bg-emerald-500/20 text-emerald-400";
      case "overdue": return "bg-red-500/20 text-red-400";
      default: return "bg-zinc-500/20 text-zinc-400";
    }
  };

  const totalOutstanding = invoices
    .filter(inv => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.total, 0);

  const totalPaid = invoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.total, 0);

  const overdueCount = invoices.filter(inv => inv.status === "overdue").length;

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShifts(prev => 
      prev.includes(shiftId) 
        ? prev.filter(id => id !== shiftId)
        : [...prev, shiftId]
    );
  };

  const createInvoiceFromShifts = () => {
    const selected = completedShifts.filter(s => selectedShifts.includes(s.id));
    if (selected.length === 0) return;

    // Group by venue
    const venues = [...new Set(selected.map(s => s.venue))];
    
    venues.forEach(venue => {
      const venueShifts = selected.filter(s => s.venue === venue);
      const subtotal = venueShifts.reduce((sum, s) => sum + (s.hours * s.rate), 0);
      const vat = subtotal * 0.2;
      
      const newInvoice: Invoice = {
        id: String(Date.now()),
        invoiceNumber: `INV-2026-${String(invoices.length + 1).padStart(3, "0")}`,
        clientName: venue,
        clientEmail: `accounts@${venue.toLowerCase().replace(/\s/g, "")}.com`,
        clientAddress: "Birmingham, UK",
        lineItems: venueShifts.map((s, idx) => ({
          id: String(idx),
          description: `Security Services`,
          date: s.date,
          staffName: s.staff,
          hours: s.hours,
          rate: s.rate,
        })),
        subtotal,
        vatRate: 20,
        vat,
        total: subtotal + vat,
        status: "draft",
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };
      
      setInvoices(prev => [newInvoice, ...prev]);
    });

    setSelectedShifts([]);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Invoice Generator</h2>
          <p className="text-sm text-zinc-400">Create and manage invoices from completed shifts</p>
        </div>
        <motion.button
          onClick={() => setShowCreateModal(true)}
          className="bg-shield-500 hover:bg-shield-600 text-white px-4 py-2 rounded-xl font-medium transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + Create Invoice
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Invoices</p>
          <p className="text-2xl font-bold text-white">{invoices.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Outstanding</p>
          <p className="text-2xl font-bold text-blue-400">£{totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Paid (This Month)</p>
          <p className="text-2xl font-bold text-emerald-400">£{totalPaid.toLocaleString()}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Overdue</p>
          <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
        </div>
      </div>

      {/* Uninvoiced Shifts Alert */}
      {completedShifts.length > 0 && (
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">
                {completedShifts.length} completed shifts not yet invoiced
              </p>
              <p className="text-sm text-zinc-400">
                £{completedShifts.reduce((sum, s) => sum + (s.hours * s.rate), 0).toLocaleString()} in unbilled work
              </p>
            </div>
            <motion.button
              onClick={() => setShowCreateModal(true)}
              className="text-amber-400 hover:text-amber-300 text-sm font-medium transition"
              whileHover={{ scale: 1.02 }}
            >
              Create Invoices →
            </motion.button>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Create Invoice from Shifts</h3>
            <button
              onClick={() => setShowCreateModal(false)}
              className="text-zinc-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-zinc-400 mb-4">
            Select completed shifts to include in the invoice:
          </p>

          <div className="space-y-2 mb-6">
            {completedShifts.map(shift => (
              <div
                key={shift.id}
                onClick={() => toggleShiftSelection(shift.id)}
                className={`p-4 rounded-lg cursor-pointer transition ${
                  selectedShifts.includes(shift.id)
                    ? "bg-shield-500/20 border border-shield-500"
                    : "bg-white/5 border border-transparent hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedShifts.includes(shift.id)
                      ? "border-shield-500 bg-shield-500"
                      : "border-zinc-600"
                  }`}>
                    {selectedShifts.includes(shift.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{shift.venue}</p>
                    <p className="text-sm text-zinc-400">
                      {shift.staff} • {new Date(shift.date).toLocaleDateString("en-GB")} • {shift.hours}hrs
                    </p>
                  </div>
                  <p className="font-semibold text-emerald-400">
                    £{(shift.hours * shift.rate).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {selectedShifts.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg mb-4">
              <span className="text-zinc-400">
                {selectedShifts.length} shift{selectedShifts.length > 1 ? "s" : ""} selected
              </span>
              <span className="font-semibold text-white">
                Subtotal: £{completedShifts
                  .filter(s => selectedShifts.includes(s.id))
                  .reduce((sum, s) => sum + (s.hours * s.rate), 0)
                  .toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <motion.button
              onClick={createInvoiceFromShifts}
              disabled={selectedShifts.length === 0}
              className="bg-shield-500 hover:bg-shield-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium transition"
              whileHover={{ scale: selectedShifts.length > 0 ? 1.02 : 1 }}
              whileTap={{ scale: selectedShifts.length > 0 ? 0.98 : 1 }}
            >
              Generate Invoice
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Invoices List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
        {invoices.map(invoice => (
          <motion.div
            key={invoice.id}
            className="glass rounded-xl p-4 hover:border-shield-500/30 transition cursor-pointer"
            onClick={() => setSelectedInvoice(invoice)}
            whileHover={{ scale: 1.005 }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono text-zinc-500">{invoice.invoiceNumber}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">{invoice.clientName}</h3>
                <p className="text-sm text-zinc-400">
                  {invoice.lineItems.length} line item{invoice.lineItems.length > 1 ? "s" : ""} • 
                  Issued {new Date(invoice.issueDate).toLocaleDateString("en-GB")}
                </p>
                {invoice.status === "overdue" && (
                  <p className="text-sm text-red-400 mt-1">
                    ⚠️ Overdue by {Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">£{invoice.total.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">
                  Due {new Date(invoice.dueDate).toLocaleDateString("en-GB")}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              {invoice.status === "draft" && (
                <button className="text-xs text-shield-400 hover:text-shield-300 transition">
                  📧 Send Invoice
                </button>
              )}
              {invoice.status === "sent" && (
                <button className="text-xs text-emerald-400 hover:text-emerald-300 transition">
                  ✓ Mark as Paid
                </button>
              )}
              {invoice.status === "overdue" && (
                <button className="text-xs text-amber-400 hover:text-amber-300 transition">
                  📧 Send Reminder
                </button>
              )}
              <button className="text-xs text-zinc-400 hover:text-white transition">
                📄 Download PDF
              </button>
              <button className="text-xs text-zinc-400 hover:text-white transition">
                👁️ Preview
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Export Options */}
      <div className="flex flex-wrap gap-3">
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📊 Export to Xero
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📊 Export to QuickBooks
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📥 Download All (CSV)
        </motion.button>
      </div>
    </div>
  );
}
