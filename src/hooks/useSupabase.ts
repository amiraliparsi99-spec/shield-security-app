"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

// Hook to get Supabase client
export function useSupabase() {
  const [supabase] = useState<TypedSupabaseClient>(() => createClient() as TypedSupabaseClient);
  return supabase;
}

// Hook to get current user
export function useUser() {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return { user, loading };
}

// Generic data fetching hook
export function useQuery<T>(
  queryFn: (supabase: TypedSupabaseClient) => Promise<T>,
  deps: any[] = [],
  options?: { enabled?: boolean }
) {
  const supabase = useSupabase();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const enabled = options?.enabled ?? true;

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn(supabase);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [supabase, enabled, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Mutation hook
export function useMutation<TData, TVariables>(
  mutationFn: (supabase: TypedSupabaseClient, variables: TVariables) => Promise<TData>
) {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables: TVariables): Promise<TData | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutationFn(supabase, variables);
      return result;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [supabase, mutationFn]);

  return { mutate, loading, error };
}
