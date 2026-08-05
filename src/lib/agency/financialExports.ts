import { generateInvoicePDF, type InvoiceData } from "@/lib/exports/pdf-generator";

export type QuoteLineItem = {
  description: string;
  quantity: number;
  hours: number;
  rate: number;
};

export type QuoteExport = {
  id: string;
  clientName: string;
  clientEmail: string;
  /** Client PO / reference number for their accounts team. */
  clientReference?: string;
  /** Billing address — client company HQ, not the event site. */
  clientAddress?: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  lineItems: QuoteLineItem[];
  notes: string;
  validUntil: string;
  status: string;
};

export type InvoiceExport = {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  clientReference?: string;
  lineItems: Array<{
    description: string;
    date: string;
    staffName: string;
    hours: number;
    rate: number;
  }>;
  subtotal: number;
  vat: number;
  total: number;
  issueDate: string;
  dueDate: string;
  notes?: string;
};

export function quoteLineTotal(item: QuoteLineItem): number {
  return item.quantity * item.hours * item.rate;
}

export function quoteTotal(quote: QuoteExport): number {
  return quote.lineItems.reduce((sum, item) => sum + quoteLineTotal(item), 0);
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateQuotePDF(quote: QuoteExport, agencyName: string): void {
  const total = quoteTotal(quote);
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quote ${quote.id}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
        .logo { font-size: 24px; font-weight: bold; color: #14b8a6; }
        .title { font-size: 28px; font-weight: 700; color: #14b8a6; }
        .meta { margin-bottom: 24px; font-size: 14px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th, td { padding: 10px 8px; border-bottom: 1px solid #e5e5e5; text-align: left; font-size: 14px; }
        th { background: #f5f5f5; text-transform: uppercase; font-size: 11px; color: #666; }
        .right { text-align: right; }
        .total { font-size: 20px; font-weight: 700; margin-top: 16px; text-align: right; }
        .notes { margin-top: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Shield</div>
        <div class="title">QUOTATION</div>
      </div>
      <div class="meta">
        <div><strong>Quote:</strong> ${quote.id}${quote.clientReference ? ` · Ref: ${quote.clientReference}` : ""}</div>
        <div><strong>From:</strong> ${agencyName}</div>
        <div><strong>To:</strong> ${quote.clientName} (${quote.clientEmail})</div>
        ${quote.clientAddress ? `<div><strong>Client address:</strong> ${quote.clientAddress}</div>` : ""}
        <div><strong>Event:</strong> ${quote.eventName} — ${new Date(quote.eventDate).toLocaleDateString("en-GB")}</div>
        <div><strong>Event location:</strong> ${quote.eventLocation}</div>
        <div><strong>Valid until:</strong> ${new Date(quote.validUntil).toLocaleDateString("en-GB")}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Staff</th>
            <th class="right">Hours</th>
            <th class="right">£/hr</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${quote.lineItems
            .map(
              (item) => `
            <tr>
              <td>${item.description}</td>
              <td class="right">${item.quantity}</td>
              <td class="right">${item.hours}</td>
              <td class="right">£${item.rate.toFixed(2)}</td>
              <td class="right">£${quoteLineTotal(item).toFixed(2)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <div class="total">Total: £${total.toFixed(2)}</div>
      ${quote.notes ? `<div class="notes"><strong>Notes</strong><br/>${quote.notes}</div>` : ""}
    </body>
    </html>
  `;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }
}

export function invoiceToPdfData(invoice: InvoiceExport, agencyName: string): InvoiceData {
  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    from: { name: agencyName },
    to: {
      name: invoice.clientName,
      address: invoice.clientAddress,
      email: invoice.clientEmail,
    },
    items: invoice.lineItems.map((item) => ({
      description: `${item.description}${item.staffName && item.staffName !== "—" ? ` — ${item.staffName}` : ""}${item.date ? ` (${item.date})` : ""}`,
      quantity: item.hours,
      rate: item.rate,
      amount: item.hours * item.rate,
    })),
    subtotal: invoice.subtotal,
    tax: invoice.vat,
    total: invoice.total,
    notes: invoice.notes
      ? invoice.clientReference
        ? `Ref: ${invoice.clientReference}\n${invoice.notes}`
        : invoice.notes
      : invoice.clientReference
        ? `Ref: ${invoice.clientReference}`
        : undefined,
  };
}

export function downloadInvoicePdf(invoice: InvoiceExport, agencyName: string): void {
  generateInvoicePDF(invoiceToPdfData(invoice, agencyName));
}

export function exportInvoicesCsv(invoices: InvoiceExport[]): void {
  downloadCsv(
    `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Invoice Number", "Client", "Issue Date", "Due Date", "Subtotal", "VAT", "Total", "Status"],
    invoices.map((inv) => [
      inv.invoiceNumber,
      inv.clientName,
      inv.issueDate,
      inv.dueDate,
      inv.subtotal.toFixed(2),
      inv.vat.toFixed(2),
      inv.total.toFixed(2),
      "",
    ]),
  );
}

/** Xero-compatible invoice import CSV (simplified). */
export function exportXeroCsv(invoices: InvoiceExport[]): void {
  const rows: string[][] = [];
  for (const inv of invoices) {
    for (const item of inv.lineItems) {
      rows.push([
        inv.invoiceNumber,
        inv.clientName,
        inv.issueDate,
        inv.dueDate,
        item.description,
        String(item.hours),
        item.rate.toFixed(2),
        "200",
        "Tax on Sales",
      ]);
    }
  }
  downloadCsv(
    `xero-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    [
      "InvoiceNumber",
      "ContactName",
      "InvoiceDate",
      "DueDate",
      "Description",
      "Quantity",
      "UnitAmount",
      "AccountCode",
      "TaxType",
    ],
    rows,
  );
}

/** QuickBooks-friendly CSV export. */
export function exportQuickBooksCsv(invoices: InvoiceExport[]): void {
  const rows: string[][] = [];
  for (const inv of invoices) {
    rows.push([
      inv.invoiceNumber,
      inv.clientName,
      inv.issueDate,
      inv.dueDate,
      inv.total.toFixed(2),
      "Security Services",
    ]);
    for (const item of inv.lineItems) {
      rows.push([
        "",
        "",
        item.date,
        item.description,
        item.staffName,
        String(item.hours),
        item.rate.toFixed(2),
        (item.hours * item.rate).toFixed(2),
      ]);
    }
  }
  downloadCsv(
    `quickbooks-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
    [
      "Invoice No",
      "Customer",
      "Invoice Date",
      "Due Date",
      "Amount",
      "Memo",
      "Line Date",
      "Line Description",
      "Staff",
      "Hours",
      "Rate",
      "Line Amount",
    ],
    rows,
  );
}
