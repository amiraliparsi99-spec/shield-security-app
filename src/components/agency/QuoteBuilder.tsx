"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAgencyProfile } from "@/hooks/useAgency";
import { generateQuotePDF, quoteTotal, quoteLineTotal } from "@/lib/agency/financialExports";

export const QUOTES_STORAGE_KEY = "shield-agency-quotes";
const QUOTES_STORAGE_KEY_LOCAL = QUOTES_STORAGE_KEY;

type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  hours: number;
  rate: number;
};

type Quote = {
  id: string;
  clientName: string;
  clientEmail: string;
  clientReference: string;
  clientAddress: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  lineItems: QuoteLineItem[];
  notes: string;
  validUntil: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  createdAt: string;
};

const mockQuotes: Quote[] = [
  {
    id: "Q-001",
    clientName: "The Grand Hotel",
    clientEmail: "events@grandhotel.com",
    clientReference: "PO-GRAND-2026-014",
    clientAddress: "1 Colmore Row, Birmingham, B3 2BJ",
    eventName: "New Year's Eve Gala",
    eventDate: "2026-12-31",
    eventLocation: "Grand Ballroom, Birmingham",
    lineItems: [
      { id: "1", description: "Door Security Staff", quantity: 4, hours: 8, rate: 18 },
      { id: "2", description: "VIP Area Security", quantity: 2, hours: 8, rate: 22 },
      { id: "3", description: "Event Supervisor", quantity: 1, hours: 8, rate: 25 },
    ],
    notes: "Includes briefing time and smart uniform.",
    validUntil: "2026-02-15",
    status: "sent",
    createdAt: "2026-01-25",
  },
  {
    id: "Q-002",
    clientName: "Birmingham Arena",
    clientEmail: "security@bhamarena.co.uk",
    clientReference: "BA-SEC-Q1-88",
    clientAddress: "King Edwards Road, Birmingham, B1 2AA",
    eventName: "Concert Security",
    eventDate: "2026-02-14",
    eventLocation: "Birmingham Arena",
    lineItems: [
      { id: "1", description: "Crowd Management", quantity: 10, hours: 6, rate: 16 },
      { id: "2", description: "Backstage Security", quantity: 4, hours: 8, rate: 20 },
    ],
    notes: "All staff SIA licensed with event experience.",
    validUntil: "2026-02-01",
    status: "accepted",
    createdAt: "2026-01-20",
  },
];

function toExportQuote(quote: Quote) {
  return {
    id: quote.id,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientReference: quote.clientReference,
    clientAddress: quote.clientAddress,
    eventName: quote.eventName,
    eventDate: quote.eventDate,
    eventLocation: quote.eventLocation,
    lineItems: quote.lineItems.map(({ description, quantity, hours, rate }) => ({
      description,
      quantity,
      hours,
      rate,
    })),
    notes: quote.notes,
    validUntil: quote.validUntil,
    status: quote.status,
  };
}

export function QuoteBuilder() {
  const { data: agency } = useAgencyProfile();
  const agencyName = agency?.name ?? "Your Agency";
  const [quotes, setQuotes] = useState<Quote[]>(mockQuotes);
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(QUOTES_STORAGE_KEY_LOCAL);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Quote>[];
        setQuotes(
          parsed.map((q) => ({
            ...q,
            clientReference: q.clientReference ?? "",
            clientAddress: q.clientAddress ?? "",
          })) as Quote[],
        );
      }
    } catch {
      /* keep defaults */
    }
  }, []);

  const persistQuotes = useCallback((next: Quote[]) => {
    setQuotes(next);
    try {
      localStorage.setItem(QUOTES_STORAGE_KEY_LOCAL, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const [newQuote, setNewQuote] = useState<Partial<Quote>>({
    clientName: "",
    clientEmail: "",
    clientReference: "",
    clientAddress: "",
    eventName: "",
    eventDate: "",
    eventLocation: "",
    lineItems: [{ id: "1", description: "", quantity: 1, hours: 1, rate: 15 }],
    notes: "",
    validUntil: "",
  });

  const calculateTotal = (items: QuoteLineItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.hours * item.rate), 0);
  };

  const addLineItem = () => {
    setNewQuote(prev => ({
      ...prev,
      lineItems: [
        ...(prev.lineItems || []),
        { id: String(Date.now()), description: "", quantity: 1, hours: 1, rate: 15 }
      ]
    }));
  };

  const removeLineItem = (id: string) => {
    setNewQuote(prev => ({
      ...prev,
      lineItems: prev.lineItems?.filter(item => item.id !== id) || []
    }));
  };

  const updateLineItem = (id: string, field: keyof QuoteLineItem, value: string | number) => {
    setNewQuote(prev => ({
      ...prev,
      lineItems: prev.lineItems?.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ) || []
    }));
  };

  const resetForm = () => {
    setEditingQuoteId(null);
    setShowNewQuote(false);
    setNewQuote({
      clientName: "",
      clientEmail: "",
      clientReference: "",
      clientAddress: "",
      eventName: "",
      eventDate: "",
      eventLocation: "",
      lineItems: [{ id: "1", description: "", quantity: 1, hours: 1, rate: 15 }],
      notes: "",
      validUntil: "",
    });
  };

  const handleSaveQuote = () => {
    const payload: Quote = {
      id: editingQuoteId ?? `Q-${String(quotes.length + 1).padStart(3, "0")}`,
      clientName: newQuote.clientName || "",
      clientEmail: newQuote.clientEmail || "",
      clientReference: newQuote.clientReference || "",
      clientAddress: newQuote.clientAddress || "",
      eventName: newQuote.eventName || "",
      eventDate: newQuote.eventDate || "",
      eventLocation: newQuote.eventLocation || "",
      lineItems: newQuote.lineItems || [],
      notes: newQuote.notes || "",
      validUntil: newQuote.validUntil || "",
      status: editingQuoteId
        ? quotes.find((q) => q.id === editingQuoteId)?.status ?? "draft"
        : "draft",
      createdAt: editingQuoteId
        ? quotes.find((q) => q.id === editingQuoteId)?.createdAt ?? new Date().toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    };

    if (editingQuoteId) {
      persistQuotes(quotes.map((q) => (q.id === editingQuoteId ? payload : q)));
    } else {
      persistQuotes([payload, ...quotes]);
    }
    resetForm();
  };

  const handleSendQuote = (quote: Quote, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = quotes.map((q) => (q.id === quote.id ? { ...q, status: "sent" as const } : q));
    persistQuotes(updated);
    const total = quoteTotal(toExportQuote(quote));
    const subject = encodeURIComponent(`Quote ${quote.id} — ${quote.eventName}`);
    const body = encodeURIComponent(
      `Hi ${quote.clientName},\n\nPlease find our quote for ${quote.eventName} on ${new Date(quote.eventDate).toLocaleDateString("en-GB")}.\n\nTotal: £${total.toFixed(2)}\nValid until: ${new Date(quote.validUntil).toLocaleDateString("en-GB")}\n\nUse Download PDF in Shield to attach the formal quote.\n\nRegards,\n${agencyName}`,
    );
    window.location.href = `mailto:${quote.clientEmail}?subject=${subject}&body=${body}`;
  };

  const handleDuplicateQuote = (quote: Quote, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicate: Quote = {
      ...quote,
      id: `Q-${String(quotes.length + 1).padStart(3, "0")}`,
      status: "draft",
      createdAt: new Date().toISOString().split("T")[0],
      lineItems: quote.lineItems.map((item) => ({ ...item, id: String(Date.now() + Math.random()) })),
    };
    persistQuotes([duplicate, ...quotes]);
  };

  const handleDownloadPdf = (quote: Quote, e: React.MouseEvent) => {
    e.stopPropagation();
    generateQuotePDF(toExportQuote(quote), agencyName);
  };

  const handleEditQuote = (quote: Quote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingQuoteId(quote.id);
    setNewQuote({
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientReference: quote.clientReference ?? "",
      clientAddress: quote.clientAddress ?? "",
      eventName: quote.eventName,
      eventDate: quote.eventDate,
      eventLocation: quote.eventLocation,
      lineItems: quote.lineItems.map((item) => ({ ...item })),
      notes: quote.notes,
      validUntil: quote.validUntil,
    });
    setShowNewQuote(true);
  };

  const getStatusColor = (status: Quote["status"]) => {
    switch (status) {
      case "draft": return "bg-zinc-500/20 text-zinc-400";
      case "sent": return "bg-blue-500/20 text-blue-400";
      case "accepted": return "bg-emerald-500/20 text-emerald-400";
      case "rejected": return "bg-red-500/20 text-red-400";
      case "expired": return "bg-amber-500/20 text-amber-400";
      default: return "bg-zinc-500/20 text-zinc-400";
    }
  };

  const totalQuoteValue = quotes.reduce((sum, q) => sum + calculateTotal(q.lineItems), 0);
  const acceptedValue = quotes
    .filter(q => q.status === "accepted")
    .reduce((sum, q) => sum + calculateTotal(q.lineItems), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Quote Builder</h2>
          <p className="text-sm text-zinc-400">Create and manage professional quotes</p>
        </div>
        <motion.button
          onClick={() => {
            setEditingQuoteId(null);
            setShowNewQuote(true);
          }}
          className="bg-shield-500 hover:bg-shield-600 text-white px-4 py-2 rounded-xl font-medium transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + New Quote
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Quotes</p>
          <p className="text-2xl font-bold text-white">{quotes.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Pipeline Value</p>
          <p className="text-2xl font-bold text-blue-400">£{totalQuoteValue.toLocaleString()}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Won Value</p>
          <p className="text-2xl font-bold text-emerald-400">£{acceptedValue.toLocaleString()}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Conversion Rate</p>
          <p className="text-2xl font-bold text-purple-400">
            {quotes.length > 0 
              ? Math.round((quotes.filter(q => q.status === "accepted").length / quotes.length) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* New Quote Form */}
      {showNewQuote && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">
              {editingQuoteId ? "Edit Quote" : "Create New Quote"}
            </h3>
            <button
              onClick={resetForm}
              className="text-zinc-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
              Client details
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Client name</label>
                <input
                  type="text"
                  value={newQuote.clientName}
                  onChange={(e) => setNewQuote(prev => ({ ...prev, clientName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                  placeholder="e.g. The Grand Hotel Ltd"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Client email</label>
                <input
                  type="email"
                  value={newQuote.clientEmail}
                  onChange={(e) => setNewQuote(prev => ({ ...prev, clientEmail: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                  placeholder="accounts@client.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Reference / PO number</label>
                <input
                  type="text"
                  value={newQuote.clientReference}
                  onChange={(e) => setNewQuote(prev => ({ ...prev, clientReference: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                  placeholder="e.g. PO-03105 or client job ref"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-400 mb-1">Client address</label>
                <input
                  type="text"
                  value={newQuote.clientAddress}
                  onChange={(e) => setNewQuote(prev => ({ ...prev, clientAddress: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                  placeholder="Company HQ / billing address — street, city, postcode"
                />
                <p className="text-[11px] text-zinc-600 mt-1">
                  Where the client company is based for invoicing — not the event site.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
              Event details
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Event name</label>
                <input
                  type="text"
                  value={newQuote.eventName}
                  onChange={(e) => setNewQuote(prev => ({ ...prev, eventName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                  placeholder="e.g. New Year's Eve Gala"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Event date</label>
                <input
                  type="date"
                  value={newQuote.eventDate}
                  onChange={(e) => setNewQuote(prev => ({ ...prev, eventDate: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-400 mb-1">Event location</label>
                <input
                  type="text"
                  value={newQuote.eventLocation}
                  onChange={(e) => setNewQuote(prev => ({ ...prev, eventLocation: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                  placeholder="Where guards work on the day — venue, site, address"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium text-zinc-400">Line items</label>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Staff × hours × hourly rate = line total
                </p>
              </div>
              <button
                type="button"
                onClick={addLineItem}
                className="text-sm text-shield-400 hover:text-shield-300 transition"
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
            <div className="space-y-3">
              {newQuote.lineItems?.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-4">
                    <label className="sm:sr-only text-[11px] text-zinc-500 mb-0.5 block">Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition"
                      placeholder="e.g. Door security"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="sm:sr-only text-[11px] text-zinc-500 mb-0.5 block">Staff</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition text-center"
                      aria-label="Number of staff"
                      min="1"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="sm:sr-only text-[11px] text-zinc-500 mb-0.5 block">Hours</label>
                    <input
                      type="number"
                      value={item.hours}
                      onChange={(e) => updateLineItem(item.id, "hours", parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition text-center"
                      aria-label="Hours per staff member"
                      min="1"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="sm:sr-only text-[11px] text-zinc-500 mb-0.5 block">Rate per hour</label>
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateLineItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition text-center"
                      aria-label="Hourly rate in pounds"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div className="col-span-10 sm:col-span-1 text-right text-sm font-medium text-emerald-400 tabular-nums">
                    £{quoteLineTotal(item).toFixed(0)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.id)}
                    className="col-span-2 sm:col-span-1 text-red-400 hover:text-red-300 transition p-2 justify-self-end"
                    disabled={newQuote.lineItems?.length === 1}
                    aria-label="Remove line item"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 text-lg font-semibold text-white">
              Total: £{calculateTotal(newQuote.lineItems || []).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Valid Until</label>
              <input
                type="date"
                value={newQuote.validUntil}
                onChange={(e) => setNewQuote(prev => ({ ...prev, validUntil: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Notes</label>
              <input
                type="text"
                value={newQuote.notes}
                onChange={(e) => setNewQuote(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <motion.button
              onClick={handleSaveQuote}
              className="bg-shield-500 hover:bg-shield-600 text-white px-6 py-2 rounded-xl font-medium transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {editingQuoteId ? "Save Changes" : "Create Quote"}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Quotes List */}
      <div className="space-y-4">
        {quotes.map(quote => (
          <div
            key={quote.id}
            className="glass rounded-xl p-4 hover:border-shield-500/30 transition cursor-pointer"
            onClick={() => setSelectedQuote(quote)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono text-zinc-500">{quote.id}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(quote.status)}`}>
                    {quote.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">{quote.clientName}</h3>
                <p className="text-sm text-zinc-400">{quote.eventName}</p>
                {quote.clientReference ? (
                  <p className="text-xs text-zinc-500 mt-0.5">Ref: {quote.clientReference}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-zinc-500">
                  <span>📅 {new Date(quote.eventDate).toLocaleDateString("en-GB")}</span>
                  <span>📍 {quote.eventLocation}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">£{calculateTotal(quote.lineItems).toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Valid until {new Date(quote.validUntil).toLocaleDateString("en-GB")}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={(e) => handleSendQuote(quote, e)}
                className="text-xs text-shield-400 hover:text-shield-300 transition"
              >
                📧 Send
              </button>
              <button
                type="button"
                onClick={(e) => handleDuplicateQuote(quote, e)}
                className="text-xs text-zinc-400 hover:text-white transition"
              >
                📋 Duplicate
              </button>
              <button
                type="button"
                onClick={(e) => handleDownloadPdf(quote, e)}
                className="text-xs text-zinc-400 hover:text-white transition"
              >
                📄 Download PDF
              </button>
              <button
                type="button"
                onClick={(e) => handleEditQuote(quote, e)}
                className="text-xs text-zinc-400 hover:text-white transition"
              >
                ✏️ Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
