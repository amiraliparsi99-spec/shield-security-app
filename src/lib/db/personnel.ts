import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database, 
  Personnel, 
  PersonnelInsert, 
  PersonnelUpdate,
  PersonnelWithAvailability 
} from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getPersonnelByUserId(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<Personnel | null> {
  const { data, error } = await supabase
    .from('personnel')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle(); // Use maybeSingle() to avoid error when no row exists

  if (error) {
    // Only log actual errors, not "no rows found" which is expected for new accounts
    if (error.code !== 'PGRST116') {
      console.error('Error fetching personnel:', JSON.stringify(error));
    }
    return null;
  }

  return data;
}

export async function getPersonnelById(
  supabase: TypedSupabaseClient,
  personnelId: string
): Promise<Personnel | null> {
  const { data, error } = await supabase
    .from('personnel')
    .select('*')
    .eq('id', personnelId)
    .single();

  if (error) {
    console.error('Error fetching personnel:', error);
    return null;
  }

  return data;
}

export async function createPersonnel(
  supabase: TypedSupabaseClient,
  personnel: PersonnelInsert
): Promise<Personnel | null> {
  const { data, error } = await supabase
    .from('personnel')
    .insert(personnel)
    .select()
    .single();

  if (error) {
    console.error('Error creating personnel:', error);
    return null;
  }

  return data;
}

export async function updatePersonnel(
  supabase: TypedSupabaseClient,
  personnelId: string,
  updates: PersonnelUpdate
): Promise<Personnel | null> {
  const { data, error } = await supabase
    .from('personnel')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', personnelId)
    .select()
    .single();

  if (error) {
    console.error('Error updating personnel:', error);
    return null;
  }

  return data;
}

export async function getAvailablePersonnel(
  supabase: TypedSupabaseClient,
  options?: {
    date?: string;
    dayOfWeek?: number;
    skills?: string[];
    maxDistance?: number;
    minShieldScore?: number;
    limit?: number;
  }
): Promise<Personnel[]> {
  let query = supabase
    .from('personnel')
    .select('*')
    .eq('is_active', true)
    .eq('is_available', true)
    .order('shield_score', { ascending: false });

  if (options?.minShieldScore) {
    query = query.gte('shield_score', options.minShieldScore);
  }

  if (options?.skills && options.skills.length > 0) {
    query = query.overlaps('skills', options.skills);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching available personnel:', error);
    return [];
  }

  // If date provided, filter by availability and blocked dates
  if (options?.date && data) {
    const personnelIds = data.map(p => p.id);
    
    // Get blocked dates for this date
    const { data: blockedDates } = await supabase
      .from('blocked_dates')
      .select('personnel_id')
      .eq('date', options.date)
      .in('personnel_id', personnelIds);

    const blockedPersonnelIds = new Set(blockedDates?.map(b => b.personnel_id) || []);
    
    return data.filter(p => !blockedPersonnelIds.has(p.id));
  }

  return data || [];
}

export async function getPersonnelWithAvailability(
  supabase: TypedSupabaseClient,
  personnelId: string
): Promise<PersonnelWithAvailability | null> {
  const { data: personnel, error: personnelError } = await supabase
    .from('personnel')
    .select('*')
    .eq('id', personnelId)
    .single();

  if (personnelError || !personnel) {
    console.error('Error fetching personnel:', personnelError);
    return null;
  }

  const { data: availability } = await supabase
    .from('availability')
    .select('*')
    .eq('personnel_id', personnelId);

  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('personnel_id', personnelId)
    .gte('date', new Date().toISOString().split('T')[0]);

  const { data: specialAvailability } = await supabase
    .from('special_availability')
    .select('*')
    .eq('personnel_id', personnelId)
    .gte('date', new Date().toISOString().split('T')[0]);

  return {
    ...personnel,
    availability: availability || [],
    blocked_dates: blockedDates || [],
    special_availability: specialAvailability || [],
  };
}

export async function updateShieldScore(
  supabase: TypedSupabaseClient,
  personnelId: string
): Promise<number | null> {
  // Call the database function to recalculate shield score
  const { data, error } = await supabase
    .rpc('calculate_shield_score', { p_personnel_id: personnelId });

  if (error) {
    console.error('Error calculating shield score:', error);
    return null;
  }

  return data;
}

export async function searchPersonnel(
  supabase: TypedSupabaseClient,
  query: string,
  limit: number = 20
): Promise<Personnel[]> {
  const { data, error } = await supabase
    .from('personnel')
    .select('*')
    .eq('is_active', true)
    .or(`display_name.ilike.%${query}%,city.ilike.%${query}%`)
    .order('shield_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching personnel:', error);
    return [];
  }

  return data || [];
}
