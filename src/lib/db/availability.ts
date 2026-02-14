import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database, 
  Availability, 
  BlockedDate, 
  SpecialAvailability 
} from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

// =====================================================
// WEEKLY AVAILABILITY
// =====================================================

export async function getWeeklyAvailability(
  supabase: TypedSupabaseClient,
  personnelId: string
): Promise<Availability[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('day_of_week', { ascending: true });

  if (error) {
    console.error('Error fetching availability:', error);
    return [];
  }

  return data || [];
}

export async function setDayAvailability(
  supabase: TypedSupabaseClient,
  personnelId: string,
  dayOfWeek: number,
  isAvailable: boolean,
  startTime?: string,
  endTime?: string
): Promise<Availability | null> {
  const { data, error } = await supabase
    .from('availability')
    .upsert({
      personnel_id: personnelId,
      day_of_week: dayOfWeek,
      is_available: isAvailable,
      start_time: startTime || null,
      end_time: endTime || null,
    }, {
      onConflict: 'personnel_id,day_of_week',
    })
    .select()
    .single();

  if (error) {
    console.error('Error setting availability:', error);
    return null;
  }

  return data;
}

export async function setWeeklySchedule(
  supabase: TypedSupabaseClient,
  personnelId: string,
  schedule: {
    dayOfWeek: number;
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
  }[]
): Promise<boolean> {
  // Delete existing schedule
  await supabase
    .from('availability')
    .delete()
    .eq('personnel_id', personnelId);

  // Insert new schedule
  const records = schedule.map(day => ({
    personnel_id: personnelId,
    day_of_week: day.dayOfWeek,
    is_available: day.isAvailable,
    start_time: day.startTime || null,
    end_time: day.endTime || null,
  }));

  const { error } = await supabase
    .from('availability')
    .insert(records);

  if (error) {
    console.error('Error setting weekly schedule:', error);
    return false;
  }

  return true;
}

// =====================================================
// BLOCKED DATES
// =====================================================

export async function getBlockedDates(
  supabase: TypedSupabaseClient,
  personnelId: string,
  fromDate?: string
): Promise<BlockedDate[]> {
  let query = supabase
    .from('blocked_dates')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('date', { ascending: true });

  if (fromDate) {
    query = query.gte('date', fromDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching blocked dates:', error);
    return [];
  }

  return data || [];
}

export async function addBlockedDate(
  supabase: TypedSupabaseClient,
  personnelId: string,
  date: string,
  reason?: string
): Promise<BlockedDate | null> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .insert({
      personnel_id: personnelId,
      date,
      reason: reason || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding blocked date:', error);
    return null;
  }

  return data;
}

export async function removeBlockedDate(
  supabase: TypedSupabaseClient,
  blockedDateId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('id', blockedDateId);

  if (error) {
    console.error('Error removing blocked date:', error);
    return false;
  }

  return true;
}

// =====================================================
// SPECIAL AVAILABILITY
// =====================================================

export async function getSpecialAvailability(
  supabase: TypedSupabaseClient,
  personnelId: string,
  fromDate?: string
): Promise<SpecialAvailability[]> {
  let query = supabase
    .from('special_availability')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('date', { ascending: true });

  if (fromDate) {
    query = query.gte('date', fromDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching special availability:', error);
    return [];
  }

  return data || [];
}

export async function addSpecialAvailability(
  supabase: TypedSupabaseClient,
  personnelId: string,
  date: string,
  startTime: string,
  endTime: string,
  note?: string
): Promise<SpecialAvailability | null> {
  const { data, error } = await supabase
    .from('special_availability')
    .upsert({
      personnel_id: personnelId,
      date,
      start_time: startTime,
      end_time: endTime,
      note: note || null,
    }, {
      onConflict: 'personnel_id,date',
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding special availability:', error);
    return null;
  }

  return data;
}

export async function removeSpecialAvailability(
  supabase: TypedSupabaseClient,
  specialAvailabilityId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('special_availability')
    .delete()
    .eq('id', specialAvailabilityId);

  if (error) {
    console.error('Error removing special availability:', error);
    return false;
  }

  return true;
}

// =====================================================
// AVAILABILITY CHECKS
// =====================================================

export interface AvailabilityCheckResult {
  available: boolean;
  reason?: string;
  conflictingShifts?: any[];
  availabilityWindow?: { start: string; end: string } | null;
}

export async function isPersonnelAvailable(
  supabase: TypedSupabaseClient,
  personnelId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const result = await checkPersonnelAvailabilityDetailed(supabase, personnelId, date, startTime, endTime);
  return result.available;
}

export async function checkPersonnelAvailabilityDetailed(
  supabase: TypedSupabaseClient,
  personnelId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<AvailabilityCheckResult> {
  // Check if date is blocked
  const { data: blockedDate } = await supabase
    .from('blocked_dates')
    .select('id, reason')
    .eq('personnel_id', personnelId)
    .eq('date', date)
    .single();

  if (blockedDate) {
    return {
      available: false,
      reason: blockedDate.reason || 'Date is blocked',
    };
  }

  // Check for existing shifts on this date that might conflict
  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;
  
  const { data: existingShifts } = await supabase
    .from('shifts')
    .select('id, scheduled_start, scheduled_end, status, booking_id')
    .eq('personnel_id', personnelId)
    .gte('scheduled_start', dateStart)
    .lte('scheduled_start', dateEnd)
    .in('status', ['pending', 'accepted', 'checked_in']);

  // Check for time overlap with existing shifts
  if (existingShifts && existingShifts.length > 0) {
    const requestedStart = new Date(`${date}T${startTime}`);
    const requestedEnd = new Date(`${date}T${endTime}`);
    
    const conflictingShifts = existingShifts.filter(shift => {
      const shiftStart = new Date(shift.scheduled_start);
      const shiftEnd = new Date(shift.scheduled_end);
      
      // Check if times overlap
      return (requestedStart < shiftEnd && requestedEnd > shiftStart);
    });

    if (conflictingShifts.length > 0) {
      return {
        available: false,
        reason: 'Already has a shift at this time',
        conflictingShifts,
      };
    }
  }

  // Check for special availability on this date
  const { data: specialAvail } = await supabase
    .from('special_availability')
    .select('*')
    .eq('personnel_id', personnelId)
    .eq('date', date)
    .single();

  if (specialAvail) {
    // Check if requested time falls within special availability
    const isWithinSpecial = startTime >= specialAvail.start_time && endTime <= specialAvail.end_time;
    if (isWithinSpecial) {
      return {
        available: true,
        availabilityWindow: { start: specialAvail.start_time, end: specialAvail.end_time },
      };
    } else {
      return {
        available: false,
        reason: `Only available ${specialAvail.start_time} - ${specialAvail.end_time}`,
        availabilityWindow: { start: specialAvail.start_time, end: specialAvail.end_time },
      };
    }
  }

  // Check regular weekly availability
  const dayOfWeek = new Date(date).getDay();
  const { data: weeklyAvail } = await supabase
    .from('availability')
    .select('*')
    .eq('personnel_id', personnelId)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (!weeklyAvail || !weeklyAvail.is_available) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      available: false,
      reason: `Not available on ${dayNames[dayOfWeek]}s`,
    };
  }

  // Check if requested time falls within weekly availability
  if (weeklyAvail.start_time && weeklyAvail.end_time) {
    // Handle overnight shifts (e.g., 22:00 - 04:00)
    const availStart = weeklyAvail.start_time;
    const availEnd = weeklyAvail.end_time;
    
    let isWithinTime = false;
    
    // Simple case: availability doesn't cross midnight
    if (availStart < availEnd) {
      isWithinTime = startTime >= availStart && endTime <= availEnd;
    } else {
      // Overnight availability (e.g., 18:00 - 02:00)
      // Request is valid if it starts after availStart OR ends before availEnd
      isWithinTime = startTime >= availStart || endTime <= availEnd;
    }
    
    if (isWithinTime) {
      return {
        available: true,
        availabilityWindow: { start: availStart, end: availEnd },
      };
    } else {
      return {
        available: false,
        reason: `Only available ${availStart} - ${availEnd}`,
        availabilityWindow: { start: availStart, end: availEnd },
      };
    }
  }

  return {
    available: weeklyAvail.is_available,
  };
}

// Get all available personnel for a specific date/time with detailed info
export async function getAvailablePersonnelForShift(
  supabase: TypedSupabaseClient,
  date: string,
  startTime: string,
  endTime: string,
  options?: {
    role?: string;
    minShieldScore?: number;
    limit?: number;
  }
): Promise<{
  personnel: any;
  availabilityInfo: AvailabilityCheckResult;
}[]> {
  // First, get all active personnel with is_available = true
  let query = supabase
    .from('personnel')
    .select('*')
    .eq('is_available', true);

  if (options?.minShieldScore) {
    query = query.gte('shield_score', options.minShieldScore);
  }

  if (options?.limit) {
    query = query.limit(options.limit * 2); // Get extra to account for filtering
  }

  const { data: allPersonnel } = await query;

  if (!allPersonnel || allPersonnel.length === 0) {
    return [];
  }

  // Check availability for each personnel
  const results: { personnel: any; availabilityInfo: AvailabilityCheckResult }[] = [];

  for (const person of allPersonnel) {
    const availabilityInfo = await checkPersonnelAvailabilityDetailed(
      supabase,
      person.id,
      date,
      startTime,
      endTime
    );

    if (availabilityInfo.available) {
      // Check role if specified
      if (options?.role) {
        const skills = person.skills as string[] || [];
        const hasRole = skills.some(s => s.toLowerCase().includes(options.role!.toLowerCase()));
        if (!hasRole) continue;
      }

      results.push({
        personnel: person,
        availabilityInfo,
      });

      if (options?.limit && results.length >= options.limit) {
        break;
      }
    }
  }

  // Sort by shield score (highest first)
  results.sort((a, b) => (b.personnel.shield_score || 0) - (a.personnel.shield_score || 0));

  return results;
}
