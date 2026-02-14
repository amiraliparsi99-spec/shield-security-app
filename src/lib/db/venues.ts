import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Venue, VenueInsert, VenueUpdate, VenueWithProfile } from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getVenueByUserId(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<Venue | null> {
  // Try user_id first (TypeScript types expect this)
  let { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // If no data found with user_id, try owner_id (some schemas use this)
  if (!data && !error) {
    const result = await supabase
      .from('venues')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle();
    data = result.data;
    error = result.error;
  }

  if (error) {
    // Only log actual errors, not "no rows found" which is expected for new accounts
    if (error.code !== 'PGRST116') {
      console.error('Error fetching venue:', JSON.stringify(error));
    }
    return null;
  }

  return data;
}

export async function getVenueById(
  supabase: TypedSupabaseClient,
  venueId: string
): Promise<Venue | null> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', venueId)
    .single();

  if (error) {
    console.error('Error fetching venue:', error);
    return null;
  }

  return data;
}

export async function createVenue(
  supabase: TypedSupabaseClient,
  venue: VenueInsert
): Promise<Venue | null> {
  const { data, error } = await supabase
    .from('venues')
    .insert(venue)
    .select()
    .single();

  if (error) {
    console.error('Error creating venue:', error);
    return null;
  }

  return data;
}

export async function updateVenue(
  supabase: TypedSupabaseClient,
  venueId: string,
  updates: VenueUpdate
): Promise<Venue | null> {
  const { data, error } = await supabase
    .from('venues')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', venueId)
    .select()
    .single();

  if (error) {
    console.error('Error updating venue:', error);
    return null;
  }

  return data;
}

export async function getAllVenues(
  supabase: TypedSupabaseClient,
  options?: {
    city?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Venue[]> {
  let query = supabase
    .from('venues')
    .select('*')
    .eq('is_active', true);

  if (options?.city) {
    query = query.eq('city', options.city);
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
    console.error('Error fetching venues:', error);
    return [];
  }

  return data || [];
}
