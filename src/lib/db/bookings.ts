import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database, 
  Booking, 
  BookingInsert, 
  BookingUpdate,
  BookingWithShifts,
  BookingStatus 
} from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getBookingById(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (error) {
    console.error('Error fetching booking:', error);
    return null;
  }

  return data;
}

export async function getBookingWithShifts(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<BookingWithShifts | null> {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(*)
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('Error fetching booking:', bookingError);
    return null;
  }

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('booking_id', bookingId);

  return {
    ...booking,
    venue: booking.venue as any,
    shifts: shifts || [],
  };
}

export async function createBooking(
  supabase: TypedSupabaseClient,
  booking: BookingInsert
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .insert(booking)
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    return null;
  }

  return data;
}

export async function updateBooking(
  supabase: TypedSupabaseClient,
  bookingId: string,
  updates: BookingUpdate
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) {
    console.error('Error updating booking:', error);
    return null;
  }

  return data;
}

export async function getVenueBookings(
  supabase: TypedSupabaseClient,
  venueId: string,
  options?: {
    status?: BookingStatus | BookingStatus[];
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Booking[]> {
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('venue_id', venueId)
    .order('event_date', { ascending: true });

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in('status', options.status);
    } else {
      query = query.eq('status', options.status);
    }
  }

  if (options?.fromDate) {
    query = query.gte('event_date', options.fromDate);
  }

  if (options?.toDate) {
    query = query.lte('event_date', options.toDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    // Handle infinite recursion RLS error gracefully
    if (error.message?.includes('infinite recursion')) {
      console.warn('RLS policy recursion detected - returning empty bookings. Fix RLS policies in Supabase dashboard.');
      return [];
    }
    // Only log if it's a real error, not just empty results
    if (error.message || error.code) {
      console.error('Error fetching venue bookings:', error.message || error.code, error);
    }
    return [];
  }

  return data || [];
}

export async function confirmBooking(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<Booking | null> {
  return updateBooking(supabase, bookingId, {
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  });
}

export async function cancelBooking(
  supabase: TypedSupabaseClient,
  bookingId: string,
  reason?: string
): Promise<Booking | null> {
  return updateBooking(supabase, bookingId, {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason || null,
  });
}

export async function completeBooking(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<Booking | null> {
  return updateBooking(supabase, bookingId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

export async function getUpcomingBookings(
  supabase: TypedSupabaseClient,
  venueId: string,
  limit: number = 5
): Promise<Booking[]> {
  const today = new Date().toISOString().split('T')[0];
  
  return getVenueBookings(supabase, venueId, {
    status: ['pending', 'confirmed'],
    fromDate: today,
    limit,
  });
}
