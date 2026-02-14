/**
 * PDF Generator Service
 * Creates PDF documents for invoices and shift reports
 * Uses browser print functionality for simplicity (no external dependencies)
 */

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  from: {
    name: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  to: {
    name: string;
    address?: string;
    email?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  tax?: number;
  total: number;
  notes?: string;
  bankDetails?: {
    sortCode: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface ShiftReportData {
  reportId: string;
  generatedAt: string;
  period: { start: string; end: string };
  personnel: {
    name: string;
    email?: string;
    shieldScore?: number;
  };
  shifts: Array<{
    date: string;
    venue: string;
    role: string;
    scheduledStart: string;
    scheduledEnd: string;
    actualStart?: string;
    actualEnd?: string;
    hoursWorked: number;
    hourlyRate: number;
    totalPay: number;
    status: string;
  }>;
  summary: {
    totalShifts: number;
    totalHours: number;
    totalEarnings: number;
    averageRating?: number;
  };
}

/**
 * Generate Invoice PDF
 */
export function generateInvoicePDF(data: InvoiceData): void {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${data.invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .logo { font-size: 28px; font-weight: bold; color: #6366f1; }
        .invoice-title { font-size: 32px; color: #6366f1; }
        .invoice-number { font-size: 14px; color: #666; margin-top: 4px; }
        .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .address-block { }
        .address-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
        .address-name { font-size: 16px; font-weight: 600; }
        .address-detail { font-size: 14px; color: #444; margin-top: 4px; }
        .dates { display: flex; gap: 40px; margin-bottom: 40px; }
        .date-block { }
        .date-label { font-size: 12px; color: #666; }
        .date-value { font-size: 14px; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { text-align: left; padding: 12px; background: #f5f5f5; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e5e5; }
        td { padding: 12px; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
        .text-right { text-align: right; }
        .totals { width: 300px; margin-left: auto; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .totals-row.total { border-top: 2px solid #1a1a1a; font-size: 18px; font-weight: bold; margin-top: 8px; padding-top: 16px; }
        .notes { margin-top: 40px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .notes-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .notes-text { font-size: 14px; color: #666; }
        .bank-details { margin-top: 24px; padding: 20px; background: #f0f0ff; border-radius: 8px; }
        .bank-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #6366f1; }
        .bank-row { font-size: 14px; margin-top: 4px; }
        .bank-label { color: #666; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Shield</div>
        <div>
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-number">#${data.invoiceNumber}</div>
        </div>
      </div>
      
      <div class="addresses">
        <div class="address-block">
          <div class="address-label">From</div>
          <div class="address-name">${data.from.name}</div>
          ${data.from.address ? `<div class="address-detail">${data.from.address}</div>` : ''}
          ${data.from.email ? `<div class="address-detail">${data.from.email}</div>` : ''}
          ${data.from.phone ? `<div class="address-detail">${data.from.phone}</div>` : ''}
        </div>
        <div class="address-block">
          <div class="address-label">Bill To</div>
          <div class="address-name">${data.to.name}</div>
          ${data.to.address ? `<div class="address-detail">${data.to.address}</div>` : ''}
          ${data.to.email ? `<div class="address-detail">${data.to.email}</div>` : ''}
        </div>
      </div>
      
      <div class="dates">
        <div class="date-block">
          <div class="date-label">Issue Date</div>
          <div class="date-value">${new Date(data.issueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div class="date-block">
          <div class="date-label">Due Date</div>
          <div class="date-value">${new Date(data.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr>
              <td>${item.description}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">£${item.rate.toFixed(2)}</td>
              <td class="text-right">£${item.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>£${data.subtotal.toFixed(2)}</span>
        </div>
        ${data.tax ? `
          <div class="totals-row">
            <span>VAT (20%)</span>
            <span>£${data.tax.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="totals-row total">
          <span>Total</span>
          <span>£${data.total.toFixed(2)}</span>
        </div>
      </div>
      
      ${data.bankDetails ? `
        <div class="bank-details">
          <div class="bank-title">Bank Details</div>
          <div class="bank-row"><span class="bank-label">Account Name:</span> ${data.bankDetails.accountName}</div>
          <div class="bank-row"><span class="bank-label">Sort Code:</span> ${data.bankDetails.sortCode}</div>
          <div class="bank-row"><span class="bank-label">Account Number:</span> ${data.bankDetails.accountNumber}</div>
        </div>
      ` : ''}
      
      ${data.notes ? `
        <div class="notes">
          <div class="notes-title">Notes</div>
          <div class="notes-text">${data.notes}</div>
        </div>
      ` : ''}
    </body>
    </html>
  `;

  openPrintWindow(html, `Invoice_${data.invoiceNumber}`);
}

/**
 * Generate Shift Report PDF
 */
export function generateShiftReportPDF(data: ShiftReportData): void {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Shift Report - ${data.personnel.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e5e5; }
        .logo { font-size: 28px; font-weight: bold; color: #6366f1; }
        .report-title { font-size: 24px; font-weight: 600; }
        .report-date { font-size: 14px; color: #666; margin-top: 4px; }
        .personnel-info { display: flex; gap: 40px; margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .personnel-block { }
        .personnel-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .personnel-value { font-size: 16px; font-weight: 500; margin-top: 4px; }
        .period { font-size: 14px; color: #666; margin-bottom: 20px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px; }
        .summary-card { padding: 16px; background: #f5f5f5; border-radius: 8px; text-align: center; }
        .summary-value { font-size: 24px; font-weight: bold; color: #6366f1; }
        .summary-label { font-size: 12px; color: #666; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; padding: 10px 8px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e5e5; }
        td { padding: 10px 8px; border-bottom: 1px solid #e5e5e5; }
        .text-right { text-align: right; }
        .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
        .status-completed { background: #d1fae5; color: #059669; }
        .status-checked_out { background: #d1fae5; color: #059669; }
        .status-pending { background: #fef3c7; color: #d97706; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; font-size: 12px; color: #666; }
        @media print { body { padding: 20px; } .summary-grid { grid-template-columns: repeat(4, 1fr); } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">Shield</div>
          <div class="report-title">Shift Report</div>
          <div class="report-date">Generated: ${new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #666;">Report ID</div>
          <div style="font-size: 14px; font-weight: 500;">${data.reportId}</div>
        </div>
      </div>
      
      <div class="personnel-info">
        <div class="personnel-block">
          <div class="personnel-label">Personnel</div>
          <div class="personnel-value">${data.personnel.name}</div>
        </div>
        ${data.personnel.email ? `
          <div class="personnel-block">
            <div class="personnel-label">Email</div>
            <div class="personnel-value">${data.personnel.email}</div>
          </div>
        ` : ''}
        ${data.personnel.shieldScore ? `
          <div class="personnel-block">
            <div class="personnel-label">Shield Score</div>
            <div class="personnel-value">${data.personnel.shieldScore}/100</div>
          </div>
        ` : ''}
      </div>
      
      <div class="period">
        Period: ${new Date(data.period.start).toLocaleDateString('en-GB')} - ${new Date(data.period.end).toLocaleDateString('en-GB')}
      </div>
      
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">${data.summary.totalShifts}</div>
          <div class="summary-label">Total Shifts</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${data.summary.totalHours.toFixed(1)}</div>
          <div class="summary-label">Hours Worked</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">£${data.summary.totalEarnings.toFixed(2)}</div>
          <div class="summary-label">Total Earnings</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${data.summary.averageRating?.toFixed(1) || 'N/A'}</div>
          <div class="summary-label">Avg Rating</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Venue</th>
            <th>Role</th>
            <th>Scheduled</th>
            <th>Actual</th>
            <th class="text-right">Hours</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Pay</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.shifts.map(shift => `
            <tr>
              <td>${new Date(shift.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
              <td>${shift.venue}</td>
              <td>${shift.role}</td>
              <td>${shift.scheduledStart} - ${shift.scheduledEnd}</td>
              <td>${shift.actualStart && shift.actualEnd ? `${shift.actualStart} - ${shift.actualEnd}` : '-'}</td>
              <td class="text-right">${shift.hoursWorked.toFixed(1)}</td>
              <td class="text-right">£${shift.hourlyRate.toFixed(2)}</td>
              <td class="text-right">£${shift.totalPay.toFixed(2)}</td>
              <td><span class="status status-${shift.status.toLowerCase()}">${shift.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        Generated by Shield • Venue & Security Marketplace
      </div>
    </body>
    </html>
  `;

  openPrintWindow(html, `ShiftReport_${data.personnel.name.replace(/\s/g, '_')}_${data.period.start}`);
}

/**
 * Open print window with HTML content
 */
function openPrintWindow(html: string, title: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
