import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportEvent = {
  id: string;
  date: string;
  eventName: string;
  guardsCount: number;
  totalCost: number;
  status: "paid" | "pending" | "overdue";
  startTime?: string;
  endTime?: string;
  staffRequirements?: { role: string; count: number; rate: number }[];
  platformFee?: number;
};

export type VenueInfo = {
  name: string;
  address?: string;
  city?: string;
  postcode?: string;
  email?: string;
  phone?: string;
};

const BRAND = { primary: [124, 58, 237] as [number, number, number] };

function fmtDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtCurrency(v: number): string {
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(t?: string): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function addHeader(doc: jsPDF, venue: VenueInfo, title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, w, 44, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Shield HQ", 16, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(venue.name, 16, 28);

  const addressParts = [venue.address, venue.city, venue.postcode].filter(Boolean);
  if (addressParts.length) doc.text(addressParts.join(", "), 16, 35);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, w - 16, 18, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, w - 16, 28, { align: "right" });

  const generated = `Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  doc.text(generated, w - 16, 35, { align: "right" });

  return 54;
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(16, h - 20, w - 16, h - 20);
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("Shield HQ — Security Management Platform", 16, h - 12);
  doc.text(`Page ${pageNum} of ${totalPages}`, w - 16, h - 12, { align: "right" });
}

// ─── CSV Export ─────────────────────────────────────────
export function exportSpendCSV(events: ReportEvent[], periodLabel: string, venue: VenueInfo) {
  const header = ["Date", "Event", "Guards", "Cost (£)", "Status"];
  const rows = events.map((e) => [
    fmtDate(e.date),
    e.eventName,
    String(e.guardsCount),
    e.totalCost.toFixed(2),
    e.status.charAt(0).toUpperCase() + e.status.slice(1),
  ]);

  const total = events.reduce((s, e) => s + e.totalCost, 0);
  rows.push(["", "", "", total.toFixed(2), "TOTAL"]);

  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `Shield_HQ_Spend_Report_${periodLabel.replace(/\s/g, "_")}.csv`);
}

// ─── PDF Spend Report ───────────────────────────────────
export function exportSpendPDF(
  events: ReportEvent[],
  periodLabel: string,
  venue: VenueInfo,
  stats: { totalSpend: number; avgPerEvent: number; pending: number; paid: number; budget: number },
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = addHeader(doc, venue, "SPEND REPORT", periodLabel);

  // Summary cards
  const cards = [
    { label: "Total Spend", value: fmtCurrency(stats.totalSpend) },
    { label: "Avg / Event", value: fmtCurrency(stats.avgPerEvent) },
    { label: "Pending", value: fmtCurrency(stats.pending) },
    { label: "Paid", value: fmtCurrency(stats.paid) },
  ];
  const cardW = (w - 32 - 12) / 4;
  cards.forEach((c, i) => {
    const x = 16 + i * (cardW + 4);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(x, y, cardW, 20, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(c.label, x + cardW / 2, y + 7, { align: "center" });
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(c.value, x + cardW / 2, y + 16, { align: "center" });
    doc.setFont("helvetica", "normal");
  });
  y += 28;

  // Budget bar
  if (stats.budget > 0) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Budget: ${fmtCurrency(stats.budget)}`, 16, y + 4);
    const pct = Math.min(stats.totalSpend / stats.budget, 1);
    doc.setFillColor(230, 230, 235);
    doc.roundedRect(16, y + 7, w - 32, 5, 2, 2, "F");
    const barColor: [number, number, number] = pct >= 1 ? [239, 68, 68] : pct >= 0.8 ? [245, 158, 11] : [16, 185, 129];
    doc.setFillColor(...barColor);
    doc.roundedRect(16, y + 7, Math.max((w - 32) * pct, 4), 5, 2, 2, "F");
    doc.setFontSize(8);
    doc.text(`${Math.round(pct * 100)}% used`, w - 16, y + 4, { align: "right" });
    y += 18;
  }

  // Events table
  autoTable(doc, {
    startY: y,
    head: [["Date", "Event", "Guards", "Cost", "Status"]],
    body: events.map((e) => [
      fmtDate(e.date),
      e.eventName,
      String(e.guardsCount),
      fmtCurrency(e.totalCost),
      e.status.charAt(0).toUpperCase() + e.status.slice(1),
    ]),
    foot: [["", "", "", fmtCurrency(stats.totalSpend), ""]],
    theme: "striped",
    headStyles: { fillColor: BRAND.primary, fontSize: 9 },
    footStyles: { fillColor: [245, 245, 250], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: 16, right: 16 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Shield_HQ_Spend_Report_${periodLabel.replace(/\s/g, "_")}.pdf`);
}

// ─── Single Event Invoice PDF ───────────────────────────
export function exportEventInvoice(event: ReportEvent, venue: VenueInfo, invoiceNumber?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  const invNo = invoiceNumber || `INV-${event.id.slice(0, 8).toUpperCase()}`;

  let y = addHeader(doc, venue, "INVOICE", invNo);

  // Invoice meta
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const metaLeft = [
    ["Invoice Number:", invNo],
    ["Date Issued:", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
    ["Status:", event.status.charAt(0).toUpperCase() + event.status.slice(1)],
  ];
  const metaRight = [
    ["Event:", event.eventName],
    ["Event Date:", fmtDate(event.date)],
    ...(event.startTime ? [["Time:", `${fmtTime(event.startTime)} – ${fmtTime(event.endTime)}`]] : []),
  ];

  metaLeft.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 16, y + i * 6);
    doc.setFont("helvetica", "normal");
    doc.text(value, 52, y + i * 6);
  });

  metaRight.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, w / 2 + 10, y + i * 6);
    doc.setFont("helvetica", "normal");
    doc.text(value, w / 2 + 40, y + i * 6);
  });

  y += Math.max(metaLeft.length, metaRight.length) * 6 + 8;

  // Line items
  const staffReqs = event.staffRequirements || [];
  const hasLineItems = staffReqs.length > 0;

  if (hasLineItems) {
    const hours = calculateHours(event.startTime, event.endTime);
    autoTable(doc, {
      startY: y,
      head: [["Role", "Qty", "Rate/hr", "Hours", "Subtotal"]],
      body: staffReqs.map((r) => {
        const subtotal = r.count * r.rate * hours;
        return [r.role, String(r.count), fmtCurrency(r.rate), String(hours), fmtCurrency(subtotal)];
      }),
      theme: "striped",
      headStyles: { fillColor: BRAND.primary, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 16, right: 16 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Totals box
  const fee = event.platformFee ?? event.totalCost * 0.05;
  const subtotal = event.totalCost - fee;

  const totalsX = w - 80;
  doc.setFillColor(248, 248, 252);
  doc.roundedRect(totalsX - 4, y, 68, 34, 2, 2, "F");

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Subtotal:", totalsX, y + 8);
  doc.text(fmtCurrency(subtotal), w - 16, y + 8, { align: "right" });

  doc.text("Platform Fee (5%):", totalsX, y + 16);
  doc.text(fmtCurrency(fee), w - 16, y + 16, { align: "right" });

  doc.setDrawColor(180, 180, 190);
  doc.line(totalsX, y + 21, w - 16, y + 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Total:", totalsX, y + 30);
  doc.text(fmtCurrency(event.totalCost), w - 16, y + 30, { align: "right" });

  y += 44;

  // Payment status badge
  const statusColors: Record<string, [number, number, number]> = {
    paid: [16, 185, 129],
    pending: [245, 158, 11],
    overdue: [239, 68, 68],
  };
  const col = statusColors[event.status] || [120, 120, 120];
  doc.setFillColor(...col);
  doc.roundedRect(16, y, 40, 8, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(event.status === "paid" ? "PAID" : event.status === "overdue" ? "OVERDUE" : "PENDING", 36, y + 5.5, {
    align: "center",
  });

  addFooter(doc, 1, 1);
  doc.save(`Shield_HQ_Invoice_${invNo}.pdf`);
}

// ─── Bulk Invoice Download (combined PDF) ───────────────
export function exportBulkInvoices(events: ReportEvent[], periodLabel: string, venue: VenueInfo) {
  if (events.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  events.forEach((event, idx) => {
    if (idx > 0) doc.addPage();

    const invNo = `INV-${event.id.slice(0, 8).toUpperCase()}`;
    let y = addHeader(doc, venue, "INVOICE", invNo);

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    const meta = [
      ["Invoice Number:", invNo],
      ["Event:", event.eventName],
      ["Event Date:", fmtDate(event.date)],
      ...(event.startTime ? [["Time:", `${fmtTime(event.startTime)} – ${fmtTime(event.endTime)}`]] : []),
      ["Status:", event.status.charAt(0).toUpperCase() + event.status.slice(1)],
    ];

    meta.forEach(([label, value], i) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 16, y + i * 6);
      doc.setFont("helvetica", "normal");
      doc.text(value, 56, y + i * 6);
    });
    y += meta.length * 6 + 8;

    // Staff table
    const staffReqs = event.staffRequirements || [];
    if (staffReqs.length > 0) {
      const hours = calculateHours(event.startTime, event.endTime);
      autoTable(doc, {
        startY: y,
        head: [["Role", "Qty", "Rate/hr", "Hours", "Subtotal"]],
        body: staffReqs.map((r) => {
          const subtotal = r.count * r.rate * hours;
          return [r.role, String(r.count), fmtCurrency(r.rate), String(hours), fmtCurrency(subtotal)];
        }),
        theme: "striped",
        headStyles: { fillColor: BRAND.primary, fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 16, right: 16 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Totals
    const fee = event.platformFee ?? event.totalCost * 0.05;
    const subtotal = event.totalCost - fee;
    const totalsX = w - 80;

    doc.setFillColor(248, 248, 252);
    doc.roundedRect(totalsX - 4, y, 68, 26, 2, 2, "F");

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Subtotal:", totalsX, y + 8);
    doc.text(fmtCurrency(subtotal), w - 16, y + 8, { align: "right" });
    doc.text("Platform Fee:", totalsX, y + 14);
    doc.text(fmtCurrency(fee), w - 16, y + 14, { align: "right" });
    doc.setDrawColor(180, 180, 190);
    doc.line(totalsX, y + 18, w - 16, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text("Total:", totalsX, y + 24);
    doc.text(fmtCurrency(event.totalCost), w - 16, y + 24, { align: "right" });
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Shield_HQ_Invoices_${periodLabel.replace(/\s/g, "_")}.pdf`);
}

// ─── Shift Attendance Evidence PDF ──────────────────────
export type ShiftEvidenceReport = {
  shiftId: string;
  eventName: string;
  eventDate: string;
  guardName: string;
  role: string;
  scheduledStart: string; // ISO
  scheduledEnd: string; // ISO
  actualStart: string | null; // ISO
  actualEnd: string | null; // ISO
  hoursWorked: number | null;
  totalPay: number | null;
  checkInMode: string | null; // 'polygon' | 'radius' | 'none'
  checkInDistanceM: number | null;
  checkOutMode: string | null;
  checkOutDistanceM: number | null;
  gpsPoints: number;
  onSitePoints: number;
  coveragePct: number;
  onSiteMinutes: number;
  venueConfirmed: boolean;
  checkpointsTotal?: number;
  checkpointsVisited?: number;
  breakMinutes?: number;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function modeLabel(mode: string | null, distanceM: number | null): string {
  if (!mode || mode === "none") return "No geofence configured";
  const dist = distanceM != null ? ` (${distanceM}m)` : "";
  if (mode === "polygon")
    return distanceM === 0
      ? "Inside drawn on-site zone"
      : `Near drawn zone${dist}`;
  if (mode === "radius") return `Within pin radius${dist}`;
  return mode;
}

export function exportShiftEvidencePDF(report: ShiftEvidenceReport, venue: VenueInfo) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = addHeader(
    doc,
    venue,
    "ATTENDANCE EVIDENCE",
    `Ref: ${report.shiftId.slice(0, 8).toUpperCase()}`,
  );

  // Summary meta
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const meta: [string, string][] = [
    ["Guard:", report.guardName],
    ["Role:", report.role],
    ["Event:", report.eventName],
    ["Date:", fmtDate(report.eventDate)],
  ];
  meta.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 16, y + i * 6);
    doc.setFont("helvetica", "normal");
    doc.text(value, 50, y + i * 6);
  });
  y += meta.length * 6 + 6;

  // Times table
  autoTable(doc, {
    startY: y,
    head: [["", "Scheduled", "Actual"]],
    body: [
      ["Start", fmtDateTime(report.scheduledStart), fmtDateTime(report.actualStart)],
      ["End", fmtDateTime(report.scheduledEnd), fmtDateTime(report.actualEnd)],
      [
        "Hours / Pay",
        "—",
        `${report.hoursWorked != null ? report.hoursWorked.toFixed(2) + "h" : "—"}` +
          `${report.totalPay != null ? " · " + fmtCurrency(report.totalPay) : ""}`,
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: BRAND.primary, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 16, right: 16 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Geofence + GPS evidence table
  autoTable(doc, {
    startY: y,
    head: [["Geofence & GPS Evidence", ""]],
    body: [
      ["Check-in location", modeLabel(report.checkInMode, report.checkInDistanceM)],
      ["Check-out location", modeLabel(report.checkOutMode, report.checkOutDistanceM)],
      ["GPS points recorded", String(report.gpsPoints)],
      ["On-site GPS points", String(report.onSitePoints)],
      ["On-site coverage", `${report.coveragePct}%`],
      ["Estimated on-site time", `${report.onSiteMinutes} min`],
      ...(report.breakMinutes && report.breakMinutes > 0
        ? [["Logged breaks", `${report.breakMinutes} min (paid)`] as [string, string]]
        : []),
      ...(report.checkpointsTotal && report.checkpointsTotal > 0
        ? [
            [
              "Patrol checkpoints",
              `${report.checkpointsVisited ?? 0} of ${report.checkpointsTotal} visited`,
            ] as [string, string],
          ]
        : []),
      ["Venue confirmed", report.venueConfirmed ? "Yes" : "Not yet"],
    ],
    theme: "striped",
    headStyles: { fillColor: BRAND.primary, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
    margin: { left: 16, right: 16 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(
    "This report is generated from GPS check-in/out records and the venue's configured on-site geofence.",
    16,
    y,
    { maxWidth: w - 32 },
  );

  addFooter(doc, 1, 1);
  doc.save(`Shield_HQ_Attendance_${report.shiftId.slice(0, 8).toUpperCase()}.pdf`);
}

// ─── Helpers ────────────────────────────────────────────
function calculateHours(start?: string, end?: string): number {
  if (!start || !end) return 6;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
