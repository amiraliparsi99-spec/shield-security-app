"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { generateInvoicePDF, generateShiftReportPDF, type InvoiceData, type ShiftReportData } from "@/lib/exports/pdf-generator";

interface ExportInvoiceButtonProps {
  invoiceData: InvoiceData;
  className?: string;
}

export function ExportInvoiceButton({ invoiceData, className = "" }: ExportInvoiceButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    generateInvoicePDF(invoiceData);
    setTimeout(() => setExporting(false), 500);
  };

  return (
    <motion.button
      onClick={handleExport}
      disabled={exporting}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition disabled:opacity-50 ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <DocumentIcon className="w-4 h-4" />
      {exporting ? 'Generating...' : 'Export PDF'}
    </motion.button>
  );
}

interface ExportShiftReportButtonProps {
  reportData: ShiftReportData;
  className?: string;
}

export function ExportShiftReportButton({ reportData, className = "" }: ExportShiftReportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    generateShiftReportPDF(reportData);
    setTimeout(() => setExporting(false), 500);
  };

  return (
    <motion.button
      onClick={handleExport}
      disabled={exporting}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition disabled:opacity-50 ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <DocumentIcon className="w-4 h-4" />
      {exporting ? 'Generating...' : 'Export Report'}
    </motion.button>
  );
}

// Quick export with demo data for testing
export function DemoExportButtons() {
  const demoInvoice: InvoiceData = {
    invoiceNumber: 'INV-2026-001',
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    from: {
      name: 'Elite Security Services',
      address: '123 Security Lane, Birmingham B1 1AA',
      email: 'billing@elitesecurity.com',
      phone: '0121 123 4567',
    },
    to: {
      name: 'Metro Nightclub',
      address: '456 Party Street, Birmingham B2 2BB',
      email: 'accounts@metronightclub.com',
    },
    items: [
      { description: 'Door Security - New Year\'s Eve Event', quantity: 6, rate: 18.00, amount: 648.00 },
      { description: 'Crowd Management Staff', quantity: 4, rate: 16.00, amount: 384.00 },
      { description: 'CCTV Monitoring', quantity: 1, rate: 150.00, amount: 150.00 },
    ],
    subtotal: 1182.00,
    tax: 236.40,
    total: 1418.40,
    bankDetails: {
      accountName: 'Elite Security Services Ltd',
      sortCode: '12-34-56',
      accountNumber: '12345678',
    },
    notes: 'Payment due within 30 days. Thank you for your business!',
  };

  const demoReport: ShiftReportData = {
    reportId: 'RPT-2026-001',
    generatedAt: new Date().toISOString(),
    period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
    personnel: {
      name: 'John Smith',
      email: 'john.smith@email.com',
      shieldScore: 87,
    },
    shifts: [
      { date: '2026-01-15', venue: 'Metro Nightclub', role: 'Door Security', scheduledStart: '21:00', scheduledEnd: '03:00', actualStart: '20:55', actualEnd: '03:10', hoursWorked: 6.25, hourlyRate: 18.00, totalPay: 112.50, status: 'Completed' },
      { date: '2026-01-18', venue: 'The Grand Hotel', role: 'Event Security', scheduledStart: '18:00', scheduledEnd: '00:00', actualStart: '17:50', actualEnd: '00:15', hoursWorked: 6.42, hourlyRate: 20.00, totalPay: 128.40, status: 'Completed' },
      { date: '2026-01-22', venue: 'Metro Nightclub', role: 'Door Security', scheduledStart: '21:00', scheduledEnd: '03:00', actualStart: '21:00', actualEnd: '03:00', hoursWorked: 6.00, hourlyRate: 18.00, totalPay: 108.00, status: 'Completed' },
      { date: '2026-01-25', venue: 'City Arena', role: 'Crowd Control', scheduledStart: '17:00', scheduledEnd: '23:00', actualStart: '16:55', actualEnd: '23:20', hoursWorked: 6.42, hourlyRate: 17.50, totalPay: 112.35, status: 'Completed' },
    ],
    summary: {
      totalShifts: 4,
      totalHours: 25.09,
      totalEarnings: 461.25,
      averageRating: 4.8,
    },
  };

  return (
    <div className="flex flex-wrap gap-3">
      <ExportInvoiceButton invoiceData={demoInvoice} />
      <ExportShiftReportButton reportData={demoReport} />
    </div>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
