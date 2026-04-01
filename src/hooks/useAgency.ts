"use client";

import { useUser, useQuery, useMutation } from "./useSupabase";
import * as db from "@/lib/db";
import type { 
  Agency, 
  AgencyUpdate, 
  Personnel,
  Shift
} from "@/lib/database.types";

// Get current user's agency profile
export function useAgencyProfile() {
  const { user } = useUser();
  
  return useQuery<Agency | null>(
    async (supabase) => {
      if (!user) return null;
      return db.getAgencyByUserId(supabase, user.id);
    },
    [user?.id]
  );
}

// Get agency staff
export function useAgencyStaff() {
  const { data: agency } = useAgencyProfile();

  return useQuery<Personnel[]>(
    async (supabase) => {
      if (!agency) return [];
      return db.getAgencyStaff(supabase, agency.id);
    },
    [agency?.id]
  );
}

// Get agency shifts
export function useAgencyShifts(options?: {
  status?: string[];
  fromDate?: string;
  toDate?: string;
  limit?: number;
}) {
  const { data: agency } = useAgencyProfile();

  return useQuery<Shift[]>(
    async (supabase) => {
      if (!agency) return [];
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('agency_id', agency.id)
        .order('scheduled_start', { ascending: true });
      
      if (error) return [];
      return data || [];
    },
    [agency?.id, JSON.stringify(options)]
  );
}

// Update agency profile
export function useUpdateAgency() {
  const { data: agency, refetch } = useAgencyProfile();

  return useMutation<Agency | null, AgencyUpdate>(
    async (supabase, updates) => {
      if (!agency) return null;
      const result = await db.updateAgency(supabase, agency.id, updates);
      refetch();
      return result;
    }
  );
}

// Add staff to agency
export function useAddStaffToAgency() {
  const { data: agency } = useAgencyProfile();
  const { refetch } = useAgencyStaff();

  return useMutation<boolean, { personnelId: string; commissionRate?: number }>(
    async (supabase, { personnelId, commissionRate }) => {
      if (!agency) return false;
      const result = await db.addStaffToAgency(supabase, agency.id, personnelId, commissionRate);
      refetch();
      return result;
    }
  );
}

// Remove staff from agency
export function useRemoveStaffFromAgency() {
  const { data: agency } = useAgencyProfile();
  const { refetch } = useAgencyStaff();

  return useMutation<boolean, string>(
    async (supabase, personnelId) => {
      if (!agency) return false;
      const result = await db.removeStaffFromAgency(supabase, agency.id, personnelId);
      refetch();
      return result;
    }
  );
}

// Average rating from reviews of agency staff (client satisfaction)
export function useAgencyAvgRating() {
  const { data: staff } = useAgencyStaff();

  return useQuery<number | null>(
    async (supabase) => {
      if (!staff?.length) return null;
      const ids = staff.map(s => s.id);
      const { data } = await supabase
        .from("reviews")
        .select("overall_rating")
        .in("reviewee_id", ids);
      if (!data?.length) return null;
      const sum = data.reduce((a, r) => a + (r.overall_rating ?? 0), 0);
      return Math.round((sum / data.length) * 10) / 10;
    },
    [staff?.length, (staff ?? []).map(s => s.id).join(",")]
  );
}

// Calculate agency stats
export function useAgencyStats() {
  const { data: agency, loading: agencyLoading } = useAgencyProfile();
  const { data: staff, loading: staffLoading } = useAgencyStaff();
  const { data: shifts, loading: shiftsLoading } = useAgencyShifts();
  const { data: avgRating } = useAgencyAvgRating();

  const loading = agencyLoading || staffLoading || shiftsLoading;

  const activeStaff = staff?.filter(s => s.is_active && s.is_available).length || 0;
  const totalStaff = staff?.length || 0;

  const completedShifts = shifts?.filter(s => s.status === 'checked_out').length || 0;
  const upcomingShifts = shifts?.filter(s => s.status === 'accepted' || s.status === 'pending').length || 0;

  const totalRevenue = shifts?.reduce((acc, s) => {
    if (s.status === 'checked_out' && s.agency_commission) {
      return acc + s.agency_commission;
    }
    return acc;
  }, 0) || 0;

  const totalHours = shifts?.reduce((acc, s) => {
    return acc + (s.hours_worked || 0);
  }, 0) || 0;

  return {
    activeStaff,
    totalStaff,
    completedShifts,
    upcomingShifts,
    totalRevenue,
    totalHours,
    avgRating: avgRating ?? undefined,
    loading,
  };
}

// Search for personnel to add to agency
export function useSearchPersonnel() {
  return useMutation<Personnel[], string>(
    async (supabase, query) => {
      return db.searchPersonnel(supabase, query);
    }
  );
}
