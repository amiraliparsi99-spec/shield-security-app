import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Agency, AgencyInsert, AgencyUpdate, Personnel } from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getAgencyByUserId(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<Agency | null> {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle(); // Use maybeSingle() to avoid error when no row exists

  if (error) {
    // Only log actual errors, not "no rows found" which is expected for new accounts
    if (error.code !== 'PGRST116') {
      console.error('Error fetching agency:', JSON.stringify(error));
    }
    return null;
  }

  return data;
}

export async function getAgencyById(
  supabase: TypedSupabaseClient,
  agencyId: string
): Promise<Agency | null> {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', agencyId)
    .single();

  if (error) {
    console.error('Error fetching agency:', error);
    return null;
  }

  return data;
}

export async function createAgency(
  supabase: TypedSupabaseClient,
  agency: AgencyInsert
): Promise<Agency | null> {
  const { data, error } = await supabase
    .from('agencies')
    .insert(agency)
    .select()
    .single();

  if (error) {
    console.error('Error creating agency:', error);
    return null;
  }

  return data;
}

export async function updateAgency(
  supabase: TypedSupabaseClient,
  agencyId: string,
  updates: AgencyUpdate
): Promise<Agency | null> {
  const { data, error } = await supabase
    .from('agencies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', agencyId)
    .select()
    .single();

  if (error) {
    console.error('Error updating agency:', error);
    return null;
  }

  return data;
}

export async function getAgencyStaff(
  supabase: TypedSupabaseClient,
  agencyId: string
): Promise<Personnel[]> {
  const { data, error } = await supabase
    .from('agency_staff')
    .select(`
      personnel:personnel_id (*)
    `)
    .eq('agency_id', agencyId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching agency staff:', error);
    return [];
  }

  // Extract personnel from joined data
  return (data?.map(d => d.personnel).filter(Boolean) as Personnel[]) || [];
}

export async function addStaffToAgency(
  supabase: TypedSupabaseClient,
  agencyId: string,
  personnelId: string,
  commissionRate?: number
): Promise<boolean> {
  const { error } = await supabase
    .from('agency_staff')
    .insert({
      agency_id: agencyId,
      personnel_id: personnelId,
      commission_rate: commissionRate || null,
      is_active: true,
    });

  if (error) {
    console.error('Error adding staff to agency:', error);
    return false;
  }

  // Update agency staff count
  await supabase.rpc('update_agency_staff_count', { p_agency_id: agencyId });

  return true;
}

export async function removeStaffFromAgency(
  supabase: TypedSupabaseClient,
  agencyId: string,
  personnelId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('agency_staff')
    .update({ is_active: false })
    .eq('agency_id', agencyId)
    .eq('personnel_id', personnelId);

  if (error) {
    console.error('Error removing staff from agency:', error);
    return false;
  }

  return true;
}

export async function getAllAgencies(
  supabase: TypedSupabaseClient,
  options?: {
    city?: string;
    verified?: boolean;
    limit?: number;
  }
): Promise<Agency[]> {
  let query = supabase
    .from('agencies')
    .select('*')
    .eq('is_active', true);

  if (options?.city) {
    query = query.eq('city', options.city);
  }
  if (options?.verified !== undefined) {
    query = query.eq('is_verified', options.verified);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order('average_rating', { ascending: false });

  if (error) {
    console.error('Error fetching agencies:', error);
    return [];
  }

  return data || [];
}
