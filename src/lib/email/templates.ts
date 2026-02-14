/**
 * Email Templates for Shield
 * Professional, responsive HTML email templates
 */

const BASE_STYLES = `
  body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .card { background: #ffffff; border-radius: 12px; padding: 32px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .header { text-align: center; padding: 24px 0; }
  .logo { font-size: 28px; font-weight: bold; color: #14b8a6; }
  .title { font-size: 24px; font-weight: 600; color: #18181b; margin: 0 0 16px 0; }
  .text { font-size: 16px; color: #52525b; line-height: 1.6; margin: 0 0 16px 0; }
  .button { display: inline-block; background: #14b8a6; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
  .button:hover { background: #0d9488; }
  .footer { text-align: center; padding: 24px; color: #a1a1aa; font-size: 14px; }
  .divider { height: 1px; background: #e4e4e7; margin: 24px 0; }
  .highlight { background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
  .meta { font-size: 14px; color: #71717a; }
  .badge { display: inline-block; background: #14b8a6; color: white; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; }
`;

function wrapTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Shield</div>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>Shield - Venue & Security Marketplace</p>
      <p>You're receiving this because you have an account with Shield.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// =====================================================
// AUTHENTICATION EMAILS
// =====================================================

export function welcomeEmail(name: string): string {
  return wrapTemplate(`
    <h1 class="title">Welcome to Shield, ${name}! 🛡️</h1>
    <p class="text">
      We're excited to have you on board. Shield connects security professionals 
      with venues looking for trusted staff.
    </p>
    <div class="highlight">
      <strong>Getting Started:</strong><br>
      Complete your profile to start receiving job opportunities or booking security staff.
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Go to Dashboard</a>
    </p>
  `);
}

export function passwordResetEmail(resetLink: string): string {
  return wrapTemplate(`
    <h1 class="title">Reset Your Password</h1>
    <p class="text">
      We received a request to reset your password. Click the button below to create a new password.
    </p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </p>
    <p class="meta">
      This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
  `);
}

export function emailVerificationEmail(verifyLink: string): string {
  return wrapTemplate(`
    <h1 class="title">Verify Your Email</h1>
    <p class="text">
      Thanks for signing up! Please verify your email address to complete your registration.
    </p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${verifyLink}" class="button">Verify Email</a>
    </p>
    <p class="meta">
      This link will expire in 24 hours.
    </p>
  `);
}

// =====================================================
// BOOKING EMAILS
// =====================================================

export function newBookingEmail(booking: {
  venueName: string;
  eventDate: string;
  eventTime: string;
  location: string;
  staffRequired: number;
  bookingId: string;
}): string {
  return wrapTemplate(`
    <h1 class="title">New Booking Request</h1>
    <p class="text">
      You have a new booking request from <strong>${booking.venueName}</strong>.
    </p>
    <div class="highlight">
      <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${booking.eventDate}</p>
      <p style="margin: 0 0 8px 0;"><strong>🕐 Time:</strong> ${booking.eventTime}</p>
      <p style="margin: 0 0 8px 0;"><strong>📍 Location:</strong> ${booking.location}</p>
      <p style="margin: 0;"><strong>👥 Staff Required:</strong> ${booking.staffRequired}</p>
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/d/agency/bookings/${booking.bookingId}" class="button">View Booking</a>
    </p>
  `);
}

export function bookingConfirmedEmail(booking: {
  eventName: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  address: string;
  agencyName: string;
}): string {
  return wrapTemplate(`
    <h1 class="title">Booking Confirmed! ✅</h1>
    <p class="text">
      Great news! Your booking for <strong>${booking.eventName}</strong> has been confirmed.
    </p>
    <div class="highlight">
      <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${booking.eventDate}</p>
      <p style="margin: 0 0 8px 0;"><strong>🕐 Time:</strong> ${booking.eventTime}</p>
      <p style="margin: 0 0 8px 0;"><strong>📍 Venue:</strong> ${booking.venueName}</p>
      <p style="margin: 0 0 8px 0;"><strong>🏢 Address:</strong> ${booking.address}</p>
      <p style="margin: 0;"><strong>🛡️ Security Provider:</strong> ${booking.agencyName}</p>
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">View Details</a>
    </p>
  `);
}

// =====================================================
// SHIFT EMAILS
// =====================================================

export function shiftOfferEmail(shift: {
  venueName: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  role: string;
  shiftId: string;
}): string {
  return wrapTemplate(`
    <h1 class="title">New Shift Available! 💼</h1>
    <p class="text">
      You've been offered a shift at <strong>${shift.venueName}</strong>.
    </p>
    <div class="highlight">
      <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${shift.date}</p>
      <p style="margin: 0 0 8px 0;"><strong>🕐 Time:</strong> ${shift.startTime} - ${shift.endTime}</p>
      <p style="margin: 0 0 8px 0;"><strong>💷 Rate:</strong> £${shift.hourlyRate.toFixed(2)}/hr</p>
      <p style="margin: 0;"><strong>👤 Role:</strong> ${shift.role}</p>
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/d/personnel/shift/${shift.shiftId}" class="button">View & Accept</a>
    </p>
    <p class="meta" style="text-align: center; margin-top: 16px;">
      Respond soon - shifts fill up quickly!
    </p>
  `);
}

export function shiftReminderEmail(shift: {
  venueName: string;
  date: string;
  startTime: string;
  address: string;
  contactPhone?: string;
}): string {
  return wrapTemplate(`
    <h1 class="title">Shift Reminder ⏰</h1>
    <p class="text">
      You have a shift tomorrow at <strong>${shift.venueName}</strong>.
    </p>
    <div class="highlight">
      <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> ${shift.date}</p>
      <p style="margin: 0 0 8px 0;"><strong>🕐 Start Time:</strong> ${shift.startTime}</p>
      <p style="margin: 0 0 8px 0;"><strong>📍 Address:</strong> ${shift.address}</p>
      ${shift.contactPhone ? `<p style="margin: 0;"><strong>📞 Contact:</strong> ${shift.contactPhone}</p>` : ''}
    </div>
    <p class="text" style="margin-top: 16px;">
      Please arrive 15 minutes early and bring your ID badge.
    </p>
  `);
}

// =====================================================
// PAYMENT EMAILS
// =====================================================

export function paymentReceivedEmail(payment: {
  amount: number;
  description: string;
  date: string;
}): string {
  return wrapTemplate(`
    <h1 class="title">Payment Received! 💰</h1>
    <p class="text">
      Good news - your payment has been processed successfully.
    </p>
    <div class="highlight">
      <p style="margin: 0 0 8px 0; font-size: 24px;"><strong>£${payment.amount.toFixed(2)}</strong></p>
      <p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${payment.description}</p>
      <p style="margin: 0;"><strong>Date:</strong> ${payment.date}</p>
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/d/personnel/earnings" class="button">View Earnings</a>
    </p>
  `);
}

export function invoiceEmail(invoice: {
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  venueName: string;
}): string {
  return wrapTemplate(`
    <h1 class="title">Invoice #${invoice.invoiceNumber}</h1>
    <p class="text">
      Here's your invoice for security services at <strong>${invoice.venueName}</strong>.
    </p>
    <div class="highlight">
      <p style="margin: 0 0 8px 0; font-size: 24px;"><strong>£${invoice.amount.toFixed(2)}</strong></p>
      <p style="margin: 0;"><strong>Due Date:</strong> ${invoice.dueDate}</p>
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.invoiceNumber}" class="button">View Invoice</a>
    </p>
  `);
}

// =====================================================
// VERIFICATION EMAILS
// =====================================================

export function documentVerifiedEmail(document: {
  type: string;
  status: 'approved' | 'rejected';
  reason?: string;
}): string {
  const isApproved = document.status === 'approved';
  
  return wrapTemplate(`
    <h1 class="title">Document ${isApproved ? 'Approved ✅' : 'Review Required ⚠️'}</h1>
    <p class="text">
      Your <strong>${document.type}</strong> has been ${isApproved ? 'verified and approved' : 'reviewed'}.
    </p>
    ${!isApproved && document.reason ? `
      <div class="highlight" style="border-left-color: #f59e0b; background: #fffbeb;">
        <p style="margin: 0;"><strong>Reason:</strong> ${document.reason}</p>
      </div>
    ` : ''}
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/verification" class="button">
        ${isApproved ? 'View Profile' : 'Resubmit Document'}
      </a>
    </p>
  `);
}

export function insuranceExpiryEmail(insurance: {
  type: string;
  expiryDate: string;
  daysRemaining: number;
}): string {
  return wrapTemplate(`
    <h1 class="title">Insurance Expiring Soon ⚠️</h1>
    <p class="text">
      Your <strong>${insurance.type}</strong> insurance will expire in <strong>${insurance.daysRemaining} days</strong>.
    </p>
    <div class="highlight" style="border-left-color: #f59e0b; background: #fffbeb;">
      <p style="margin: 0;"><strong>Expiry Date:</strong> ${insurance.expiryDate}</p>
    </div>
    <p class="text">
      Please renew your insurance and upload the new certificate to avoid any interruption to your work.
    </p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/d/personnel/settings" class="button">Update Insurance</a>
    </p>
  `);
}
