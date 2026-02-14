import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Profile, ProfileUpdate, UserRole } from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getProfile(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

export async function createProfile(
  supabase: TypedSupabaseClient,
  userId: string,
  role: UserRole,
  email: string,
  displayName?: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      role,
      email,
      display_name: displayName || null,
      is_verified: false,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    return null;
  }

  return data;
}

export async function updateProfile(
  supabase: TypedSupabaseClient,
  userId: string,
  updates: ProfileUpdate
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return null;
  }

  return data;
}

export async function getProfileRole(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    // Try to get role from user metadata as fallback
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.role) {
      return user.user_metadata.role as UserRole;
    }
    return null;
  }

  return data?.role || null;
}

export async function updateLastActive(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
}
