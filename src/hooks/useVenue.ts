"use client";

import { useUser, useQuery, useMutation } from "./useSupabase";
import * as db from "@/lib/db";
import type { 
  Venue, 
  VenueUpdate, 
  Booking,
  BookingInsert,
  BookingStatus,
  Personnel,
  EventTemplate
} from "@/lib/database.types";

// Get current user's venue profile
export function useVenueProfile() {
  const { user } = useUser();
  
  return useQuery<Venue | null>(
    async (supabase) => {
      if (!user) return null;
      return db.getVenueByUserId(supabase, user.id);
    },
    [user?.id]
  );
}

// Get venue bookings
export function useVenueBookings(options?: {
  status?: BookingStatus | BookingStatus[];
  fromDate?: string;
  toDate?: string;
  limit?: number;
}) {
  const { data: venue, loading: venueLoading } = useVenueProfile();

  return useQuery<Booking[]>(
    async (supabase) => {
      // Don't fetch if venue is not loaded yet or doesn't exist
      if (!venue?.id) return [];
      return db.getVenueBookings(supabase, venue.id, options);
    },
    [venue?.id, JSON.stringify(options)],
    { enabled: !venueLoading && !!venue?.id } // Only run when venue is ready
  );
}

// Get upcoming bookings
export function useUpcomingBookings(limit: number = 5) {
  const { data: venue, loading: venueLoading } = useVenueProfile();

  return useQuery<Booking[]>(
    async (supabase) => {
      if (!venue?.id) return [];
      return db.getUpcomingBookings(supabase, venue.id, limit);
    },
    [venue?.id, limit],
    { enabled: !venueLoading && !!venue?.id }
  );
}

// Get available personnel for a date
export function useAvailablePersonnel(options?: {
  date?: string;
  skills?: string[];
  minShieldScore?: number;
  limit?: number;
}) {
  return useQuery<Personnel[]>(
    async (supabase) => {
      return db.getAvailablePersonnel(supabase, options);
    },
    [JSON.stringify(options)]
  );
}

// Get preferred staff
export function usePreferredStaff() {
  const { data: venue, loading: venueLoading } = useVenueProfile();

  return useQuery<{ personnel: Personnel; note: string | null }[]>(
    async (supabase) => {
      if (!venue?.id) return [];
      const { data, error } = await supabase
        .from('preferred_staff')
        .select(`
          note,
          personnel:personnel_id (*)
        `)
        .eq('venue_id', venue.id);
      
      if (error) return [];
      return data?.map(d => ({
        personnel: d.personnel as any as Personnel,
        note: d.note,
      })) || [];
    },
    [venue?.id],
    { enabled: !venueLoading && !!venue?.id }
  );
}

// Get blocked staff
export function useBlockedStaff() {
  const { data: venue, loading: venueLoading } = useVenueProfile();

  return useQuery<{ personnel: Personnel; reason: string | null }[]>(
    async (supabase) => {
      if (!venue?.id) return [];
      const { data, error } = await supabase
        .from('blocked_staff')
        .select(`
          reason,
          personnel:personnel_id (*)
        `)
        .eq('venue_id', venue.id);
      
      if (error) return [];
      return data?.map(d => ({
        personnel: d.personnel as any as Personnel,
        reason: d.reason,
      })) || [];
    },
    [venue?.id],
    { enabled: !venueLoading && !!venue?.id }
  );
}

// Get event templates
export function useEventTemplates() {
  const { data: venue, loading: venueLoading } = useVenueProfile();

  return useQuery<EventTemplate[]>(
    async (supabase) => {
      if (!venue?.id) return [];
      const { data, error } = await supabase
        .from('event_templates')
        .select('*')
        .eq('venue_id', venue.id)
        .order('created_at', { ascending: false });
      
      if (error) return [];
      return data || [];
    },
    [venue?.id],
    { enabled: !venueLoading && !!venue?.id }
  );
}

// Update venue profile
export function useUpdateVenue() {
  const { data: venue, refetch } = useVenueProfile();

  return useMutation<Venue | null, VenueUpdate>(
    async (supabase, updates) => {
      if (!venue) return null;
      const result = await db.updateVenue(supabase, venue.id, updates);
      refetch();
      return result;
    }
  );
}

// Create booking
export function useCreateBooking() {
  const { refetch } = useUpcomingBookings();

  return useMutation<Booking | null, BookingInsert>(
    async (supabase, booking) => {
      const result = await db.createBooking(supabase, booking);
      refetch();
      return result;
    }
  );
}

// Cancel booking
export function useCancelBooking() {
  const { refetch } = useVenueBookings();

  return useMutation<Booking | null, { bookingId: string; reason?: string }>(
    async (supabase, { bookingId, reason }) => {
      const result = await db.cancelBooking(supabase, bookingId, reason);
      refetch();
      return result;
    }
  );
}

// Add preferred staff
export function useAddPreferredStaff() {
  const { data: venue } = useVenueProfile();
  const { refetch } = usePreferredStaff();

  return useMutation<boolean, { personnelId: string; note?: string }>(
    async (supabase, { personnelId, note }) => {
      if (!venue) return false;
      const { error } = await supabase
        .from('preferred_staff')
        .insert({
          venue_id: venue.id,
          personnel_id: personnelId,
          note: note || null,
        });
      
      if (error) return false;
      refetch();
      return true;
    }
  );
}

// Remove preferred staff
export function useRemovePreferredStaff() {
  const { data: venue } = useVenueProfile();
  const { refetch } = usePreferredStaff();

  return useMutation<boolean, string>(
    async (supabase, personnelId) => {
      if (!venue) return false;
      const { error } = await supabase
        .from('preferred_staff')
        .delete()
        .eq('venue_id', venue.id)
        .eq('personnel_id', personnelId);
      
      if (error) return false;
      refetch();
      return true;
    }
  );
}

// Add blocked staff
export function useAddBlockedStaff() {
  const { data: venue } = useVenueProfile();
  const { refetch } = useBlockedStaff();

  return useMutation<boolean, { personnelId: string; reason?: string }>(
    async (supabase, { personnelId, reason }) => {
      if (!venue) return false;
      const { error } = await supabase
        .from('blocked_staff')
        .insert({
          venue_id: venue.id,
          personnel_id: personnelId,
          reason: reason || null,
        });
      
      if (error) return false;
      refetch();
      return true;
    }
  );
}

// Save event template
export function useSaveEventTemplate() {
  const { data: venue } = useVenueProfile();
  const { refetch } = useEventTemplates();

  return useMutation<EventTemplate | null, {
    name: string;
    staffRequirements: any[];
    briefNotes?: string;
    isAiGenerated?: boolean;
  }>(
    async (supabase, template) => {
      if (!venue) return null;
      const { data, error } = await supabase
        .from('event_templates')
        .insert({
          venue_id: venue.id,
          name: template.name,
          staff_requirements: template.staffRequirements,
          brief_notes: template.briefNotes || null,
          is_ai_generated: template.isAiGenerated || false,
        })
        .select()
        .single();
      
      if (error) return null;
      refetch();
      return data;
    }
  );
}

// Delete event template
export function useDeleteEventTemplate() {
  const { refetch } = useEventTemplates();

  return useMutation<boolean, string>(
    async (supabase, templateId) => {
      const { error } = await supabase
        .from('event_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) return false;
      refetch();
      return true;
    }
  );
}

// Calculate venue spend
export function useVenueSpend() {
  const { data: bookings, loading } = useVenueBookings({ status: 'completed' });

  const totalSpend = bookings?.reduce((acc, booking) => {
    return acc + (booking.final_total || booking.estimated_total || 0);
  }, 0) || 0;

  const totalBookings = bookings?.length || 0;

  return {
    totalSpend,
    totalBookings,
    loading,
  };
}
