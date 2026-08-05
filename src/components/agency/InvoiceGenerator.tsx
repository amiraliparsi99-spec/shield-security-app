"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAgencyProfile } from "@/hooks/useAgency";
import { QUOTES_STORAGE_KEY } from "@/components/agency/QuoteBuilder";
import {
  downloadInvoicePdf,
  exportInvoicesCsv,
  exportQuickBooksCsv,
  exportXeroCsv,
  quoteLineTotal,
  type InvoiceExport,
} from "@/lib/agency/financialExports";

const INVOICES_STORAGE_KEY = "shield-agency-invoices";

type InvoiceLineItem = {
  id: string;
  description: string;
  date: string;
  staffName: string;
  hours: number;
  rate: number;
};

type ManualLineItem = {
  id: string;
  description: string;
  quantity: number;
  hours: number;
  rate: number;
};

type StoredQuote = {
  id: string;
  clientName: string;
  clientEmail: string;
  clientReference?: string;
  clientAddress?: string;
  eventName: string;
  eventDate: string;
  lineItems: ManualLineItem[];
  status: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  clientReference: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatRate: number;
  vat: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  source?: "manual" | "shifts" | "quote";
};

type CreateTab = "manual" | "quotes" | "shifts";

const mockInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-2026-001",
    clientName: "The Grand Club",
    clientEmail: "accounts@grandclub.com",
    clientAddress: "123 Broad Street, Birmingham, B1 2AB",
    clientReference: "PO-GRAND-NYE",
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
    clientReference: "BA-INV-002",
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
    clientReference: "MB-W4",
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

function toExportInvoice(invoice: Invoice): InvoiceExport {
  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientAddress: invoice.clientAddress,
    clientReference: invoice.clientReference || undefined,
    lineItems: invoice.lineItems.map(({ description, date, staffName, hours, rate }) => ({
      description,
      date,
      staffName,
      hours,
      rate,
    })),
    subtotal: invoice.subtotal,
    vat: invoice.vat,
    total: invoice.total,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
  };
}

function manualLineSubtotal(items: ManualLineItem[]): number {
  return items.reduce((sum, item) => sum + quoteLineTotal(item), 0);
}

function manualToInvoiceLineItems(items: ManualLineItem[], defaultDate: string): InvoiceLineItem[] {
  return items.map((item, idx) => ({
    id: String(idx),
    description: item.description,
    date: defaultDate,
    staffName: item.quantity > 1 ? `${item.quantity} staff` : "—",
    hours: item.quantity * item.hours,
    rate: item.rate,
  }));
}

function nextInvoiceNumber(existing: Invoice[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const nums = existing
    .map((inv) => inv.invoiceNumber.match(/INV-\d+-(\d+)/)?.[1])
    .filter(Boolean)
    .map((n) => parseInt(n!, 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function buildInvoicePayload(params: {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  clientReference: string;
  lineItems: InvoiceLineItem[];
  issueDate: string;
  dueDate: string;
  notes?: string;
  source: Invoice["source"];
  vatRate?: number;
}): Invoice {
  const subtotal = params.lineItems.reduce((sum, item) => sum + item.hours * item.rate, 0);
  const vatRate = params.vatRate ?? 20;
  const vat = subtotal * (vatRate / 100);
  return {
    id: String(Date.now() + Math.random()),
    invoiceNumber: params.invoiceNumber,
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    clientAddress: params.clientAddress,
    clientReference: params.clientReference,
    lineItems: params.lineItems,
    subtotal,
    vatRate,
    vat,
    total: subtotal + vat,
    status: "draft",
    issueDate: params.issueDate,
    dueDate: params.dueDate,
    notes: params.notes,
    source: params.source,
  };
}

const emptyManualLine = (): ManualLineItem => ({
  id: String(Date.now()),
  description: "",
  quantity: 1,
  hours: 1,
  rate: 15,
});

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition text-sm";

export function InvoiceGenerator() {
  const { data: agency } = useAgencyProfile();
  const agencyName = agency?.name ?? "Your Agency";
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [completedShifts] = useState(mockCompletedShifts);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTab, setCreateTab] = useState<CreateTab>("manual");
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [storedQuotes, setStoredQuotes] = useState<StoredQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const defaultDue = useMemo(() => {
    return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }, []);

  const [manualForm, setManualForm] = useState({
    invoiceNumber: "",
    clientName: "",
    clientEmail: "",
    clientReference: "",
    clientAddress: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: defaultDue,
    notes: "",
    lineItems: [emptyManualLine()] as ManualLineItem[],
  });

  const loadQuotes = useCallback(() => {
    try {
      const raw = localStorage.getItem(QUOTES_STORAGE_KEY);
      if (raw) setStoredQuotes(JSON.parse(raw));
    } catch {
      setStoredQuotes([]);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(INVOICES_STORAGE_KEY);
      if (stored) setInvoices(JSON.parse(stored));
    } catch {
      /* keep defaults */
    }
    loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    if (showCreateModal) {
      loadQuotes();
      setManualForm((f) => ({
        ...f,
        invoiceNumber: f.invoiceNumber || nextInvoiceNumber(invoices),
      }));
    }
  }, [showCreateModal, invoices, loadQuotes]);

  const billableQuotes = useMemo(
    () => storedQuotes.filter((q) => q.status === "accepted" || q.status === "sent"),
    [storedQuotes],
  );

  const persistInvoices = useCallback((next: Invoice[]) => {
    setInvoices(next);
    try {
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const updateInvoice = (id: string, patch: Partial<Invoice>) => {
    persistInvoices(invoices.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)));
  };

  const handleDownloadPdf = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadInvoicePdf(toExportInvoice(invoice), agencyName);
  };

  const handlePreview = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewInvoice(invoice);
  };

  const handleSendInvoice = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    updateInvoice(invoice.id, { status: "sent" });
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber} from ${agencyName}`);
    const body = encodeURIComponent(
      `Hi ${invoice.clientName},\n\nPlease find invoice ${invoice.invoiceNumber} for £${invoice.total.toFixed(2)}.\nDue date: ${new Date(invoice.dueDate).toLocaleDateString("en-GB")}\n\nUse Download PDF in Shield for the full breakdown.\n\nRegards,\n${agencyName}`,
    );
    window.location.href = `mailto:${invoice.clientEmail}?subject=${subject}&body=${body}`;
  };

  const handleMarkPaid = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    updateInvoice(invoice.id, {
      status: "paid",
      paidDate: new Date().toISOString().split("T")[0],
    });
  };

  const handleSendReminder = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const subject = encodeURIComponent(`Payment reminder — ${invoice.invoiceNumber}`);
    const body = encodeURIComponent(
      `Hi ${invoice.clientName},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber} for £${invoice.total.toFixed(2)} was due on ${new Date(invoice.dueDate).toLocaleDateString("en-GB")}.\n\nPlease let us know if you need a copy.\n\nRegards,\n${agencyName}`,
    );
    window.location.href = `mailto:${invoice.clientEmail}?subject=${subject}&body=${body}`;
  };

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
    const selected = completedShifts.filter((s) => selectedShifts.includes(s.id));
    if (selected.length === 0) return;

    const venues = [...new Set(selected.map((s) => s.venue))];
    const created: Invoice[] = [];

    venues.forEach((venue) => {
      const venueShifts = selected.filter((s) => s.venue === venue);
      const lineItems = venueShifts.map((s, idx) => ({
        id: String(idx),
        description: "Security Services",
        date: s.date,
        staffName: s.staff,
        hours: s.hours,
        rate: s.rate,
      }));

      created.push(
        buildInvoicePayload({
          invoiceNumber: nextInvoiceNumber([...created, ...invoices]),
          clientName: venue,
          clientEmail: `accounts@${venue.toLowerCase().replace(/\s/g, "")}.com`,
          clientAddress: "",
          clientReference: "",
          lineItems,
          issueDate: new Date().toISOString().split("T")[0],
          dueDate: defaultDue,
          source: "shifts",
        }),
      );
    });

    persistInvoices([...created, ...invoices]);
    setSelectedShifts([]);
    setShowCreateModal(false);
  };

  const createInvoiceFromQuote = () => {
    const quote = billableQuotes.find((q) => q.id === selectedQuoteId);
    if (!quote) return;

    const lineItems = manualToInvoiceLineItems(quote.lineItems, quote.eventDate);
    const invoice = buildInvoicePayload({
      invoiceNumber: nextInvoiceNumber(invoices),
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientAddress: quote.clientAddress ?? "",
      clientReference: quote.clientReference ?? quote.id,
      lineItems,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: defaultDue,
      notes: `Event: ${quote.eventName} (${new Date(quote.eventDate).toLocaleDateString("en-GB")})`,
      source: "quote",
    });

    persistInvoices([invoice, ...invoices]);
    setSelectedQuoteId(null);
    setShowCreateModal(false);
  };

  const updateManualLine = (id: string, field: keyof ManualLineItem, value: string | number) => {
    setManualForm((f) => ({
      ...f,
      lineItems: f.lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const createManualInvoice = () => {
    if (!manualForm.clientName.trim()) return;

    const lineItems = manualToInvoiceLineItems(manualForm.lineItems, manualForm.issueDate);
    const invoice = buildInvoicePayload({
      invoiceNumber: manualForm.invoiceNumber || nextInvoiceNumber(invoices),
      clientName: manualForm.clientName,
      clientEmail: manualForm.clientEmail,
      clientAddress: manualForm.clientAddress,
      clientReference: manualForm.clientReference,
      lineItems,
      issueDate: manualForm.issueDate,
      dueDate: manualForm.dueDate,
      notes: manualForm.notes || undefined,
      source: "manual",
    });

    persistInvoices([invoice, ...invoices]);
    setShowCreateModal(false);
    setManualForm({
      invoiceNumber: "",
      clientName: "",
      clientEmail: "",
      clientReference: "",
      clientAddress: "",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: defaultDue,
      notes: "",
      lineItems: [emptyManualLine()],
    });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedShifts([]);
    setSelectedQuoteId(null);
    setCreateTab("manual");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Invoice Generator</h2>
          <p className="text-sm text-zinc-400">Create invoices manually, from quotes, or from completed shifts</p>
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
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Create invoice</h3>
            <button
              type="button"
              onClick={closeCreateModal}
              className="text-zinc-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
            {(
              [
                ["manual", "Manual invoice"],
                ["quotes", "From quote"],
                ["shifts", "From shifts"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCreateTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  createTab === tab
                    ? "bg-shield-500/20 text-shield-300 border border-shield-500/40"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {createTab === "manual" && (
            <div className="space-y-6">
              <p className="text-sm text-zinc-400">
                Build an invoice from scratch — no quote or shift required.
              </p>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                  Client details
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Client name</label>
                    <input
                      className={inputClass}
                      value={manualForm.clientName}
                      onChange={(e) => setManualForm((f) => ({ ...f, clientName: e.target.value }))}
                      placeholder="Client company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Client email</label>
                    <input
                      type="email"
                      className={inputClass}
                      value={manualForm.clientEmail}
                      onChange={(e) => setManualForm((f) => ({ ...f, clientEmail: e.target.value }))}
                      placeholder="accounts@client.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Reference / PO number</label>
                    <input
                      className={inputClass}
                      value={manualForm.clientReference}
                      onChange={(e) => setManualForm((f) => ({ ...f, clientReference: e.target.value }))}
                      placeholder="Client reference for accounts"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Invoice number</label>
                    <input
                      className={inputClass}
                      value={manualForm.invoiceNumber}
                      onChange={(e) => setManualForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                      placeholder="Auto-generated if blank"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-zinc-400 mb-1">Client address</label>
                    <input
                      className={inputClass}
                      value={manualForm.clientAddress}
                      onChange={(e) => setManualForm((f) => ({ ...f, clientAddress: e.target.value }))}
                      placeholder="Billing address — company HQ, street, city, postcode"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Issue date</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={manualForm.issueDate}
                      onChange={(e) => setManualForm((f) => ({ ...f, issueDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Due date</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={manualForm.dueDate}
                      onChange={(e) => setManualForm((f) => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Line items
                    </h4>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Staff × hours × £/hr</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setManualForm((f) => ({
                        ...f,
                        lineItems: [...f.lineItems, emptyManualLine()],
                      }))
                    }
                    className="text-sm text-shield-400 hover:text-shield-300"
                  >
                    + Add item
                  </button>
                </div>
                <div className="hidden sm:grid grid-cols-12 gap-2 px-1 mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <span className="col-span-4">Description</span>
                  <span className="col-span-2 text-center">Staff</span>
                  <span className="col-span-2 text-center">Hours</span>
                  <span className="col-span-2 text-center">£/hr</span>
                  <span className="col-span-1 text-right">Total</span>
                  <span className="col-span-1" />
                </div>
                <div className="space-y-2">
                  {manualForm.lineItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        className={`col-span-12 sm:col-span-4 ${inputClass} !py-2`}
                        value={item.description}
                        onChange={(e) => updateManualLine(item.id, "description", e.target.value)}
                        placeholder="Description"
                        aria-label="Line description"
                      />
                      <input
                        type="number"
                        className={`col-span-4 sm:col-span-2 ${inputClass} !py-2 text-center`}
                        value={item.quantity}
                        onChange={(e) => updateManualLine(item.id, "quantity", parseInt(e.target.value) || 0)}
                        aria-label="Staff count"
                        min={1}
                      />
                      <input
                        type="number"
                        className={`col-span-4 sm:col-span-2 ${inputClass} !py-2 text-center`}
                        value={item.hours}
                        onChange={(e) => updateManualLine(item.id, "hours", parseInt(e.target.value) || 0)}
                        aria-label="Hours"
                        min={1}
                      />
                      <input
                        type="number"
                        className={`col-span-4 sm:col-span-2 ${inputClass} !py-2 text-center`}
                        value={item.rate}
                        onChange={(e) => updateManualLine(item.id, "rate", parseFloat(e.target.value) || 0)}
                        aria-label="Hourly rate"
                        min={0}
                        step={0.5}
                      />
                      <span className="col-span-3 sm:col-span-1 text-right text-sm text-emerald-400 tabular-nums">
                        £{quoteLineTotal(item).toFixed(0)}
                      </span>
                      <button
                        type="button"
                        className="col-span-1 text-red-400 p-2"
                        disabled={manualForm.lineItems.length === 1}
                        onClick={() =>
                          setManualForm((f) => ({
                            ...f,
                            lineItems: f.lineItems.filter((l) => l.id !== item.id),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3 text-white font-semibold">
                  Subtotal (ex VAT): £{manualLineSubtotal(manualForm.lineItems).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Notes (optional)</label>
                <input
                  className={inputClass}
                  value={manualForm.notes}
                  onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Payment terms, bank details reminder, etc."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeCreateModal} className="px-4 py-2 text-zinc-400 hover:text-white">
                  Cancel
                </button>
                <motion.button
                  type="button"
                  onClick={createManualInvoice}
                  disabled={!manualForm.clientName.trim()}
                  className="bg-shield-500 hover:bg-shield-600 disabled:bg-zinc-700 text-white px-6 py-2 rounded-xl font-medium"
                  whileTap={{ scale: 0.98 }}
                >
                  Create invoice
                </motion.button>
              </div>
            </div>
          )}

          {createTab === "quotes" && (
            <div>
              <p className="text-sm text-zinc-400 mb-4">
                Turn a sent or accepted quote into a draft invoice. Client details and line items
                carry over automatically.
              </p>
              {billableQuotes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                  No sent or accepted quotes yet. Create a quote first, or use a manual invoice.
                </div>
              ) : (
                <div className="space-y-2 mb-6 max-h-72 overflow-y-auto">
                  {billableQuotes.map((quote) => {
                    const total = quote.lineItems.reduce((s, i) => s + quoteLineTotal(i), 0);
                    return (
                      <button
                        key={quote.id}
                        type="button"
                        onClick={() => setSelectedQuoteId(quote.id)}
                        className={`w-full text-left p-4 rounded-lg transition ${
                          selectedQuoteId === quote.id
                            ? "bg-shield-500/20 border border-shield-500"
                            : "bg-white/5 border border-transparent hover:bg-white/10"
                        }`}
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{quote.clientName}</p>
                            <p className="text-sm text-zinc-400">{quote.eventName}</p>
                            <p className="text-xs text-zinc-500 mt-1">
                              {quote.id}
                              {quote.clientReference ? ` · Ref: ${quote.clientReference}` : ""} ·{" "}
                              {quote.status}
                            </p>
                          </div>
                          <p className="font-semibold text-emerald-400 shrink-0">£{total.toFixed(2)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeCreateModal} className="px-4 py-2 text-zinc-400 hover:text-white">
                  Cancel
                </button>
                <motion.button
                  type="button"
                  onClick={createInvoiceFromQuote}
                  disabled={!selectedQuoteId}
                  className="bg-shield-500 hover:bg-shield-600 disabled:bg-zinc-700 text-white px-6 py-2 rounded-xl font-medium"
                  whileTap={{ scale: 0.98 }}
                >
                  Create from quote
                </motion.button>
              </div>
            </div>
          )}

          {createTab === "shifts" && (
            <>
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
                <button type="button" onClick={closeCreateModal} className="px-4 py-2 text-zinc-400 hover:text-white">
                  Cancel
                </button>
                <motion.button
                  type="button"
                  onClick={createInvoiceFromShifts}
                  disabled={selectedShifts.length === 0}
                  className="bg-shield-500 hover:bg-shield-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium transition"
                  whileHover={{ scale: selectedShifts.length > 0 ? 1.02 : 1 }}
                  whileTap={{ scale: selectedShifts.length > 0 ? 0.98 : 1 }}
                >
                  Generate invoice
                </motion.button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Invoices List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
        {invoices.map(invoice => (
          <div
            key={invoice.id}
            className="glass rounded-xl p-4 hover:border-shield-500/30 transition cursor-pointer"
            onClick={() => setSelectedInvoice(invoice)}
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
                {invoice.clientReference ? (
                  <p className="text-xs text-zinc-500">Ref: {invoice.clientReference}</p>
                ) : null}
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
                <button
                  type="button"
                  onClick={(e) => handleSendInvoice(invoice, e)}
                  className="text-xs text-shield-400 hover:text-shield-300 transition"
                >
                  📧 Send Invoice
                </button>
              )}
              {invoice.status === "sent" && (
                <button
                  type="button"
                  onClick={(e) => handleMarkPaid(invoice, e)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                >
                  ✓ Mark as Paid
                </button>
              )}
              {invoice.status === "overdue" && (
                <button
                  type="button"
                  onClick={(e) => handleSendReminder(invoice, e)}
                  className="text-xs text-amber-400 hover:text-amber-300 transition"
                >
                  📧 Send Reminder
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleDownloadPdf(invoice, e)}
                className="text-xs text-zinc-400 hover:text-white transition"
              >
                📄 Download PDF
              </button>
              <button
                type="button"
                onClick={(e) => handlePreview(invoice, e)}
                className="text-xs text-zinc-400 hover:text-white transition"
              >
                👁️ Preview
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Export Options */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => exportXeroCsv(invoices.map(toExportInvoice))}
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
        >
          📊 Export to Xero
        </button>
        <button
          type="button"
          onClick={() => exportQuickBooksCsv(invoices.map(toExportInvoice))}
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
        >
          📊 Export to QuickBooks
        </button>
        <button
          type="button"
          onClick={() => exportInvoicesCsv(invoices.map(toExportInvoice))}
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
        >
          📥 Download All (CSV)
        </button>
      </div>

      {/* Preview modal */}
      {previewInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{previewInvoice.invoiceNumber}</h3>
                <p className="text-sm text-zinc-400">{previewInvoice.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 mb-4 text-sm text-zinc-300">
              <p>
                <span className="text-zinc-500">From:</span> {agencyName}
              </p>
              <p>
                <span className="text-zinc-500">To:</span> {previewInvoice.clientName}
                {previewInvoice.clientReference ? ` · Ref: ${previewInvoice.clientReference}` : ""}
              </p>
              <p>
                <span className="text-zinc-500">Address:</span> {previewInvoice.clientAddress || "—"}
              </p>
              <p>
                <span className="text-zinc-500">Email:</span> {previewInvoice.clientEmail}
              </p>
              <p>
                <span className="text-zinc-500">Issued:</span>{" "}
                {new Date(previewInvoice.issueDate).toLocaleDateString("en-GB")} · Due:{" "}
                {new Date(previewInvoice.dueDate).toLocaleDateString("en-GB")}
              </p>
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-white/10">
                  <th className="py-2">Description</th>
                  <th className="py-2">Staff</th>
                  <th className="py-2 text-right">Hrs</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewInvoice.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-white/5 text-zinc-300">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2">{item.staffName}</td>
                    <td className="py-2 text-right">{item.hours}</td>
                    <td className="py-2 text-right">£{item.rate.toFixed(2)}</td>
                    <td className="py-2 text-right">£{(item.hours * item.rate).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right space-y-1 text-sm">
              <p className="text-zinc-400">Subtotal: £{previewInvoice.subtotal.toFixed(2)}</p>
              <p className="text-zinc-400">VAT ({previewInvoice.vatRate}%): £{previewInvoice.vat.toFixed(2)}</p>
              <p className="text-lg font-semibold text-white">Total: £{previewInvoice.total.toFixed(2)}</p>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => downloadInvoicePdf(toExportInvoice(previewInvoice), agencyName)}
                className="px-4 py-2 rounded-lg bg-shield-500 text-white text-sm hover:bg-shield-600"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
