/**
 * Notification Triggers
 * Functions to send push notifications for various events
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
}

/**
 * Get user's active push tokens
 */
async function getUserPushTokens(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<Array<{ token: string; platform: string }>> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token, platform')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching push tokens:', error);
    return [];
  }

  return data || [];
}

/**
 * Log notification in database
 */
async function logNotification(
  supabase: SupabaseClient<any>,
  userId: string,
  payload: NotificationPayload,
  relatedId?: string
): Promise<void> {
  await supabase.from('notification_log').insert({
    user_id: userId,
    title: payload.title,
    body: payload.body,
    notification_type: payload.type,
    related_id: relatedId,
    data: payload.data,
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}

/**
 * Create in-app notification
 */
async function createInAppNotification(
  supabase: SupabaseClient<any>,
  userId: string,
  payload: NotificationPayload,
  relatedId?: string
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: userId,
    title: payload.title,
    message: payload.body,
    type: payload.type as any,
    data: payload.data,
    related_id: relatedId,
  });
}

// =====================================================
// NOTIFICATION TRIGGERS
// =====================================================

/**
 * Notify user of incoming call
 */
export async function notifyIncomingCall(
  supabase: SupabaseClient<any>,
  receiverUserId: string,
  callerName: string,
  callId: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Incoming Call',
    body: `${callerName} is calling you`,
    type: 'call',
    data: {
      callId,
      callerName,
      type: 'call',
    },
  };

  await Promise.all([
    logNotification(supabase, receiverUserId, payload, callId),
    createInAppNotification(supabase, receiverUserId, payload, callId),
  ]);

  // Note: Actual push sending would be done via Edge Function or server
  // For now, we just log and create in-app notification
}

/**
 * Notify user of missed call
 */
export async function notifyMissedCall(
  supabase: SupabaseClient<any>,
  receiverUserId: string,
  callerName: string,
  callId: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Missed Call',
    body: `You missed a call from ${callerName}`,
    type: 'call',
    data: {
      callId,
      callerName,
      type: 'missed_call',
    },
  };

  await Promise.all([
    logNotification(supabase, receiverUserId, payload, callId),
    createInAppNotification(supabase, receiverUserId, payload, callId),
  ]);
}

/**
 * Notify venue of new booking request
 */
export async function notifyNewBooking(
  supabase: SupabaseClient<any>,
  venueUserId: string,
  eventName: string,
  bookingId: string,
  eventDate: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'New Booking Request',
    body: `New booking: ${eventName} on ${new Date(eventDate).toLocaleDateString()}`,
    type: 'booking',
    data: {
      bookingId,
      eventName,
      eventDate,
      type: 'booking',
    },
  };

  await Promise.all([
    logNotification(supabase, venueUserId, payload, bookingId),
    createInAppNotification(supabase, venueUserId, payload, bookingId),
  ]);
}

/**
 * Notify personnel of new shift offer
 */
export async function notifyShiftOffer(
  supabase: SupabaseClient<any>,
  personnelUserId: string,
  venueName: string,
  shiftId: string,
  shiftDate: string,
  hourlyRate: number
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'New Shift Available',
    body: `${venueName} - ${new Date(shiftDate).toLocaleDateString()} at £${hourlyRate}/hr`,
    type: 'shift',
    data: {
      shiftId,
      venueName,
      shiftDate,
      hourlyRate,
      type: 'shift_offer',
    },
  };

  await Promise.all([
    logNotification(supabase, personnelUserId, payload, shiftId),
    createInAppNotification(supabase, personnelUserId, payload, shiftId),
  ]);
}

/**
 * Notify personnel of shift acceptance
 */
export async function notifyShiftAccepted(
  supabase: SupabaseClient<any>,
  personnelUserId: string,
  venueName: string,
  shiftId: string,
  shiftDate: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Shift Confirmed',
    body: `Your shift at ${venueName} on ${new Date(shiftDate).toLocaleDateString()} is confirmed`,
    type: 'shift',
    data: {
      shiftId,
      venueName,
      shiftDate,
      type: 'shift_confirmed',
    },
  };

  await Promise.all([
    logNotification(supabase, personnelUserId, payload, shiftId),
    createInAppNotification(supabase, personnelUserId, payload, shiftId),
  ]);
}

/**
 * Notify venue when personnel accepts shift
 */
export async function notifyShiftFilled(
  supabase: SupabaseClient<any>,
  venueUserId: string,
  personnelName: string,
  bookingId: string,
  eventName: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Shift Filled',
    body: `${personnelName} accepted a shift for ${eventName}`,
    type: 'booking',
    data: {
      bookingId,
      personnelName,
      eventName,
      type: 'shift_filled',
    },
  };

  await Promise.all([
    logNotification(supabase, venueUserId, payload, bookingId),
    createInAppNotification(supabase, venueUserId, payload, bookingId),
  ]);
}

/**
 * Notify user of new message
 */
export async function notifyNewMessage(
  supabase: SupabaseClient<any>,
  receiverUserId: string,
  senderName: string,
  conversationId: string,
  messagePreview: string
): Promise<void> {
  const payload: NotificationPayload = {
    title: senderName,
    body: messagePreview.length > 100 
      ? messagePreview.substring(0, 100) + '...' 
      : messagePreview,
    type: 'message',
    data: {
      conversationId,
      senderName,
      type: 'message',
    },
  };

  await Promise.all([
    logNotification(supabase, receiverUserId, payload, conversationId),
    createInAppNotification(supabase, receiverUserId, payload, conversationId),
  ]);
}

/**
 * Notify personnel of shift reminder (upcoming shift)
 */
export async function notifyShiftReminder(
  supabase: SupabaseClient<any>,
  personnelUserId: string,
  venueName: string,
  shiftId: string,
  startTime: string
): Promise<void> {
  const shiftDate = new Date(startTime);
  const hours = Math.round((shiftDate.getTime() - Date.now()) / (1000 * 60 * 60));
  
  const payload: NotificationPayload = {
    title: 'Shift Reminder',
    body: `Your shift at ${venueName} starts in ${hours} hour${hours === 1 ? '' : 's'}`,
    type: 'shift',
    data: {
      shiftId,
      venueName,
      startTime,
      type: 'shift_reminder',
    },
  };

  await Promise.all([
    logNotification(supabase, personnelUserId, payload, shiftId),
    createInAppNotification(supabase, personnelUserId, payload, shiftId),
  ]);
}

/**
 * Notify user of document verification status
 */
export async function notifyDocumentVerified(
  supabase: SupabaseClient<any>,
  personnelUserId: string,
  documentType: string,
  status: 'verified' | 'rejected',
  documentId: string
): Promise<void> {
  const isVerified = status === 'verified';
  const payload: NotificationPayload = {
    title: isVerified ? 'Document Verified' : 'Document Rejected',
    body: isVerified 
      ? `Your ${documentType} has been verified`
      : `Your ${documentType} was not approved. Please upload a new document.`,
    type: 'verification',
    data: {
      documentId,
      documentType,
      status,
      type: 'document_verification',
    },
  };

  await Promise.all([
    logNotification(supabase, personnelUserId, payload, documentId),
    createInAppNotification(supabase, personnelUserId, payload, documentId),
  ]);
}
