/**
 * Email Sending Functions
 * High-level functions for sending specific types of emails
 */

import { sendEmail } from './resend';
import * as templates from './templates';

// =====================================================
// AUTHENTICATION
// =====================================================

export async function sendWelcomeEmail(to: string, name: string) {
  return sendEmail({
    to,
    subject: 'Welcome to Shield! 🛡️',
    html: templates.welcomeEmail(name),
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  return sendEmail({
    to,
    subject: 'Reset Your Password - Shield',
    html: templates.passwordResetEmail(resetLink),
  });
}

export async function sendEmailVerification(to: string, verifyLink: string) {
  return sendEmail({
    to,
    subject: 'Verify Your Email - Shield',
    html: templates.emailVerificationEmail(verifyLink),
  });
}

// =====================================================
// BOOKINGS
// =====================================================

export async function sendNewBookingNotification(
  to: string,
  booking: Parameters<typeof templates.newBookingEmail>[0]
) {
  return sendEmail({
    to,
    subject: `New Booking Request - ${booking.venueName}`,
    html: templates.newBookingEmail(booking),
  });
}

export async function sendBookingConfirmation(
  to: string,
  booking: Parameters<typeof templates.bookingConfirmedEmail>[0]
) {
  return sendEmail({
    to,
    subject: `Booking Confirmed - ${booking.eventName}`,
    html: templates.bookingConfirmedEmail(booking),
  });
}

// =====================================================
// SHIFTS
// =====================================================

export async function sendShiftOffer(
  to: string,
  shift: Parameters<typeof templates.shiftOfferEmail>[0]
) {
  return sendEmail({
    to,
    subject: `New Shift Available - ${shift.venueName}`,
    html: templates.shiftOfferEmail(shift),
  });
}

export async function sendShiftReminder(
  to: string,
  shift: Parameters<typeof templates.shiftReminderEmail>[0]
) {
  return sendEmail({
    to,
    subject: `Shift Reminder - ${shift.venueName} Tomorrow`,
    html: templates.shiftReminderEmail(shift),
  });
}

// =====================================================
// PAYMENTS
// =====================================================

export async function sendPaymentNotification(
  to: string,
  payment: Parameters<typeof templates.paymentReceivedEmail>[0]
) {
  return sendEmail({
    to,
    subject: `Payment Received - £${payment.amount.toFixed(2)}`,
    html: templates.paymentReceivedEmail(payment),
  });
}

export async function sendInvoice(
  to: string,
  invoice: Parameters<typeof templates.invoiceEmail>[0]
) {
  return sendEmail({
    to,
    subject: `Invoice #${invoice.invoiceNumber} - Shield`,
    html: templates.invoiceEmail(invoice),
  });
}

// =====================================================
// VERIFICATION
// =====================================================

export async function sendDocumentVerificationResult(
  to: string,
  document: Parameters<typeof templates.documentVerifiedEmail>[0]
) {
  const statusText = document.status === 'approved' ? 'Approved' : 'Review Required';
  return sendEmail({
    to,
    subject: `Document ${statusText} - ${document.type}`,
    html: templates.documentVerifiedEmail(document),
  });
}

export async function sendInsuranceExpiryWarning(
  to: string,
  insurance: Parameters<typeof templates.insuranceExpiryEmail>[0]
) {
  return sendEmail({
    to,
    subject: `Insurance Expiring in ${insurance.daysRemaining} Days - Action Required`,
    html: templates.insuranceExpiryEmail(insurance),
  });
}
