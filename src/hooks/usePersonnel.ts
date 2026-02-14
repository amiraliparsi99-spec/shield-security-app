"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser, useQuery, useMutation, useSupabase } from "./useSupabase";
import * as db from "@/lib/db";
import type { 
  Personnel, 
  PersonnelUpdate, 
  Shift, 
  Availability,
  BlockedDate,
  SpecialAvailability,
  Document
} from "@/lib/database.types";

// Get current user's personnel profile
export function usePersonnelProfile() {
  const { user } = useUser();
  
  return useQuery<Personnel | null>(
    async (supabase) => {
      if (!user) return null;
      return db.getPersonnelByUserId(supabase, user.id);
    },
    [user?.id]
  );
}

// Get personnel shifts
export function usePersonnelShifts(options?: {
  status?: string[];
  fromDate?: string;
  limit?: number;
}) {
  const { data: personnel, loading: personnelLoading } = usePersonnelProfile();

  return useQuery<Shift[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getPersonnelShifts(supabase, personnel.id, options as any);
      } catch (e) {
        console.error("Shifts fetch error:", e);
        return [];
      }
    },
    [personnel?.id, JSON.stringify(options), personnelLoading]
  );
}

// Get upcoming shifts
export function useUpcomingShifts(limit: number = 5) {
  const { data: personnel, loading: personnelLoading } = usePersonnelProfile();

  return useQuery<Shift[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getUpcomingShifts(supabase, personnel.id, limit);
      } catch (e) {
        return [];
      }
    },
    [personnel?.id, limit, personnelLoading]
  );
}

// Get shift history
export function useShiftHistory(limit: number = 20) {
  const { data: personnel, loading: personnelLoading } = usePersonnelProfile();

  return useQuery<Shift[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getShiftHistory(supabase, personnel.id, limit);
      } catch (e) {
        return [];
      }
    },
    [personnel?.id, limit, personnelLoading]
  );
}

/**
 * Hook for realtime shift updates
 * Subscribes to Supabase realtime and automatically refreshes shift data
 */
export function useRealtimeShifts(personnelId?: string) {
  const supabase = useSupabase();
  const { data: personnel } = usePersonnelProfile();
  const targetPersonnelId = personnelId || personnel?.id;
  
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial shifts
  const fetchShifts = useCallback(async () => {
    if (!targetPersonnelId) {
      setShifts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await db.getPersonnelShifts(supabase, targetPersonnelId, {
        status: ['pending', 'accepted', 'checked_in'],
        fromDate: new Date().toISOString(),
      });
      setShifts(data);
      setError(null);
    } catch (e) {
      console.error('Error fetching shifts:', e);
      setError('Failed to fetch shifts');
    } finally {
      setLoading(false);
    }
  }, [supabase, targetPersonnelId]);

  // Initial fetch
  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!targetPersonnelId) return;

    const channel = supabase
      .channel(`shifts:${targetPersonnelId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'shifts',
          filter: `personnel_id=eq.${targetPersonnelId}`,
        },
        (payload) => {
          console.log('Shift realtime update:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            setShifts(prev => [...prev, payload.new as Shift]);
          } else if (payload.eventType === 'UPDATE') {
            setShifts(prev => 
              prev.map(s => s.id === (payload.new as Shift).id ? payload.new as Shift : s)
            );
          } else if (payload.eventType === 'DELETE') {
            setShifts(prev => 
              prev.filter(s => s.id !== (payload.old as Shift).id)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to shift updates for', targetPersonnelId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, targetPersonnelId]);

  return { 
    shifts, 
    loading, 
    error, 
    refetch: fetchShifts 
  };
}

/**
 * Hook for realtime booking shift updates (for venues)
 * Listens to all shift updates for a specific booking
 */
export function useRealtimeBookingShifts(bookingId?: string) {
  const supabase = useSupabase();
  
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial shifts
  const fetchShifts = useCallback(async () => {
    if (!bookingId) {
      setShifts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await db.getBookingShifts(supabase, bookingId);
      setShifts(data);
    } catch (e) {
      console.error('Error fetching booking shifts:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase, bookingId]);

  // Initial fetch
  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`booking-shifts:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          console.log('Booking shift update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            setShifts(prev => [...prev, payload.new as Shift]);
          } else if (payload.eventType === 'UPDATE') {
            setShifts(prev => 
              prev.map(s => s.id === (payload.new as Shift).id ? payload.new as Shift : s)
            );
          } else if (payload.eventType === 'DELETE') {
            setShifts(prev => 
              prev.filter(s => s.id !== (payload.old as Shift).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, bookingId]);

  return { 
    shifts, 
    loading, 
    refetch: fetchShifts 
  };
}

// Get weekly availability
export function useWeeklyAvailability() {
  const { data: personnel } = usePersonnelProfile();

  return useQuery<Availability[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getWeeklyAvailability(supabase, personnel.id);
      } catch (e) {
        return [];
      }
    },
    [personnel?.id]
  );
}

// Get blocked dates
export function useBlockedDates() {
  const { data: personnel } = usePersonnelProfile();
  const today = new Date().toISOString().split('T')[0];

  return useQuery<BlockedDate[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getBlockedDates(supabase, personnel.id, today);
      } catch (e) {
        return [];
      }
    },
    [personnel?.id]
  );
}

// Get special availability
export function useSpecialAvailability() {
  const { data: personnel } = usePersonnelProfile();
  const today = new Date().toISOString().split('T')[0];

  return useQuery<SpecialAvailability[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getSpecialAvailability(supabase, personnel.id, today);
      } catch (e) {
        return [];
      }
    },
    [personnel?.id]
  );
}

// Get documents
export function usePersonnelDocuments() {
  const { data: personnel } = usePersonnelProfile();

  return useQuery<Document[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getPersonnelDocuments(supabase, personnel.id);
      } catch (e) {
        return [];
      }
    },
    [personnel?.id]
  );
}

// Get expiring documents
export function useExpiringDocuments(daysAhead: number = 30) {
  const { data: personnel } = usePersonnelProfile();

  return useQuery<Document[]>(
    async (supabase) => {
      if (!personnel?.id) return [];
      try {
        return await db.getExpiringDocuments(supabase, personnel.id, daysAhead);
      } catch (e) {
        return [];
      }
    },
    [personnel?.id, daysAhead]
  );
}

// Update personnel profile
export function useUpdatePersonnel() {
  const { data: personnel, refetch } = usePersonnelProfile();

  return useMutation<Personnel | null, PersonnelUpdate>(
    async (supabase, updates) => {
      if (!personnel) return null;
      const result = await db.updatePersonnel(supabase, personnel.id, updates);
      refetch();
      return result;
    }
  );
}

// Set weekly availability
export function useSetWeeklySchedule() {
  const { data: personnel } = usePersonnelProfile();
  const { refetch } = useWeeklyAvailability();

  return useMutation<boolean, {
    dayOfWeek: number;
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
  }[]>(
    async (supabase, schedule) => {
      if (!personnel) return false;
      const result = await db.setWeeklySchedule(supabase, personnel.id, schedule);
      refetch();
      return result;
    }
  );
}

// Add blocked date
export function useAddBlockedDate() {
  const { data: personnel } = usePersonnelProfile();
  const { refetch } = useBlockedDates();

  return useMutation<BlockedDate | null, { date: string; reason?: string }>(
    async (supabase, { date, reason }) => {
      if (!personnel) return null;
      const result = await db.addBlockedDate(supabase, personnel.id, date, reason);
      refetch();
      return result;
    }
  );
}

// Remove blocked date
export function useRemoveBlockedDate() {
  const { refetch } = useBlockedDates();

  return useMutation<boolean, string>(
    async (supabase, blockedDateId) => {
      const result = await db.removeBlockedDate(supabase, blockedDateId);
      refetch();
      return result;
    }
  );
}

// Accept shift
export function useAcceptShift() {
  const { refetch: refetchUpcoming } = useUpcomingShifts();

  return useMutation<{ success: boolean; shift: Shift | null; error?: string }, string>(
    async (supabase, shiftId) => {
      const result = await db.acceptShift(supabase, shiftId);
      if (result.success) {
        refetchUpcoming();
      }
      return result;
    }
  );
}

// Decline shift
export function useDeclineShift() {
  const { refetch: refetchUpcoming } = useUpcomingShifts();

  return useMutation<{ success: boolean; shift: Shift | null; error?: string }, { shiftId: string; reason?: string }>(
    async (supabase, { shiftId, reason }) => {
      const result = await db.declineShift(supabase, shiftId, reason);
      if (result.success) {
        refetchUpcoming();
      }
      return result;
    }
  );
}

// Check in to shift
export function useCheckInShift() {
  return useMutation<{ success: boolean; shift: Shift | null; error?: string }, { shiftId: string; latitude: number; longitude: number }>(
    async (supabase, { shiftId, latitude, longitude }) => {
      return db.checkInShift(supabase, shiftId, latitude, longitude);
    }
  );
}

// Check out from shift
export function useCheckOutShift() {
  return useMutation<{ success: boolean; shift: Shift | null; error?: string }, { shiftId: string; latitude: number; longitude: number }>(
    async (supabase, { shiftId, latitude, longitude }) => {
      return db.checkOutShift(supabase, shiftId, latitude, longitude);
    }
  );
}

// Cancel shift
export function useCancelShift() {
  const { refetch: refetchUpcoming } = useUpcomingShifts();

  return useMutation<{ success: boolean; shift: Shift | null; error?: string }, { shiftId: string; cancelledBy: 'venue' | 'personnel' | 'agency'; reason?: string }>(
    async (supabase, { shiftId, cancelledBy, reason }) => {
      const result = await db.cancelShift(supabase, shiftId, cancelledBy, reason);
      if (result.success) {
        refetchUpcoming();
      }
      return result;
    }
  );
}

// Calculate earnings from shifts and actual payments
export function useEarnings() {
  const supabase = useSupabase();
  const { user } = useUser();
  const { data: shifts, loading: shiftsLoading } = useShiftHistory(100);
  const [transactions, setTransactions] = useState<{ net_amount: number; status: string }[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  // Fetch actual payments from transactions
  useEffect(() => {
    async function fetchTransactions() {
      if (!user) return;
      
      const { data } = await supabase
        .from('transactions')
        .select('net_amount, status')
        .eq('payee_id', user.id)
        .eq('type', 'payment');
      
      setTransactions(data || []);
      setTxLoading(false);
    }
    
    fetchTransactions();
  }, [user, supabase]);

  // Earnings from actual payments (succeeded transactions)
  const paidEarnings = transactions
    .filter(tx => tx.status === 'succeeded')
    .reduce((acc, tx) => acc + (tx.net_amount || 0), 0) / 100; // Convert from pence

  // Pending payments
  const pendingPayments = transactions
    .filter(tx => tx.status === 'pending')
    .reduce((acc, tx) => acc + (tx.net_amount || 0), 0) / 100;

  // Estimated earnings from upcoming/confirmed shifts (not yet paid)
  const pendingFromShifts = shifts?.reduce((acc, shift) => {
    if ((shift.status === 'accepted' || shift.status === 'pending' || shift.status === 'checked_in') && shift.hourly_rate) {
      const start = new Date(shift.scheduled_start);
      const end = new Date(shift.scheduled_end);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return acc + (hours * shift.hourly_rate);
    }
    return acc;
  }, 0) || 0;

  const totalHours = shifts?.reduce((acc, shift) => {
    return acc + (shift.hours_worked || 0);
  }, 0) || 0;

  return {
    totalEarnings: paidEarnings,
    pendingEarnings: pendingPayments + pendingFromShifts,
    totalHours,
    loading: shiftsLoading || txLoading,
  };
}
