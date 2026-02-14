import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database, 
  Notification, 
  NotificationInsert,
  NotificationType 
} from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getUserNotifications(
  supabase: TypedSupabaseClient,
  userId: string,
  options?: {
    unreadOnly?: boolean;
    type?: NotificationType;
    limit?: number;
    offset?: number;
  }
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
}

export async function getUnreadCount(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
}

export async function createNotification(
  supabase: TypedSupabaseClient,
  notification: NotificationInsert
): Promise<Notification | null> {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data;
}

export async function markAsRead(
  supabase: TypedSupabaseClient,
  notificationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  return true;
}

export async function markAllAsRead(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }

  return true;
}

export async function deleteNotification(
  supabase: TypedSupabaseClient,
  notificationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    return false;
  }

  return true;
}

// Helper to create common notification types
export async function notifyBookingCreated(
  supabase: TypedSupabaseClient,
  userId: string,
  bookingId: string,
  eventName: string
): Promise<Notification | null> {
  return createNotification(supabase, {
    user_id: userId,
    type: 'booking',
    title: 'New Booking Request',
    body: `New booking request for "${eventName}"`,
    data: { booking_id: bookingId },
    is_read: false,
  });
}

export async function notifyShiftAssigned(
  supabase: TypedSupabaseClient,
  userId: string,
  shiftId: string,
  venueName: string,
  date: string
): Promise<Notification | null> {
  return createNotification(supabase, {
    user_id: userId,
    type: 'shift',
    title: 'New Shift Available',
    body: `You've been assigned a shift at ${venueName} on ${date}`,
    data: { shift_id: shiftId },
    is_read: false,
  });
}

export async function notifyShiftReminder(
  supabase: TypedSupabaseClient,
  userId: string,
  shiftId: string,
  venueName: string,
  startTime: string
): Promise<Notification | null> {
  return createNotification(supabase, {
    user_id: userId,
    type: 'shift',
    title: 'Shift Reminder',
    body: `Your shift at ${venueName} starts at ${startTime}`,
    data: { shift_id: shiftId },
    is_read: false,
  });
}

export async function notifyDocumentExpiring(
  supabase: TypedSupabaseClient,
  userId: string,
  documentId: string,
  documentName: string,
  expiryDate: string
): Promise<Notification | null> {
  return createNotification(supabase, {
    user_id: userId,
    type: 'verification',
    title: 'Document Expiring Soon',
    body: `Your ${documentName} expires on ${expiryDate}`,
    data: { document_id: documentId },
    is_read: false,
  });
}
