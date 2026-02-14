"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

type AuthState = {
  user: User | null;
  role: Role | null;
  loading: boolean;
  refetchRole: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRole = useCallback(
    async (userId: string, metadataRole?: string | null) => {
      // Try user_id first (0003 structure)
      let { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .single();
      
      // If no result, try id (0001 structure where id = user_id)
      if (!data) {
        const { data: dataById } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        data = dataById;
      }
      
      if (data?.role && ["venue", "personnel", "agency", "admin"].includes(data.role)) {
        setRole(data.role as Role);
        return;
      }
      if (metadataRole && ["venue", "personnel", "agency", "admin"].includes(metadataRole)) {
        setRole(metadataRole as Role);
      } else {
        setRole(null);
      }
    },
    [supabase]
  );

  const refetchRole = useCallback(async () => {
    if (user?.id) {
      await fetchRole(user.id, user.user_metadata?.role);
    } else if (typeof window !== "undefined") {
      const g = localStorage.getItem("shield_guest_role");
      setRole(g && ["venue", "personnel", "agency", "admin"].includes(g) ? (g as Role) : null);
    } else {
      setRole(null);
    }
  }, [user?.id, user?.user_metadata?.role, fetchRole]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchRole(session.user.id, session.user.user_metadata?.role).catch(() => setRole(null));
      } else if (typeof window !== "undefined") {
        const g = localStorage.getItem("shield_guest_role");
        setRole(g && ["venue", "personnel", "agency"].includes(g) ? (g as Role) : null);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchRole(session.user.id, session.user.user_metadata?.role).catch(() => setRole(null));
      } else if (typeof window !== "undefined") {
        const g = localStorage.getItem("shield_guest_role");
        setRole(g && ["venue", "personnel", "agency"].includes(g) ? (g as Role) : null);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, fetchRole]);

  return (
    <AuthContext.Provider value={{ user, role, loading, refetchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
