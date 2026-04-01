import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type AuthUser = {
  id: string;
  email?: string;
} | null;

export type PersonnelRecord = {
  id: string;
  user_id: string;
  display_name: string;
  city?: string;
  postcode?: string | null;
} | null;

export type VenueInfo = {
  id: string;
  name: string;
  user_id: string;
} | null;

interface AuthState {
  user: AuthUser;
  personnelId: string | null;
  personnelRecord: PersonnelRecord;
  venueId: string | null;
  venueInfo: VenueInfo;
  loaded: boolean;
  setUser: (user: AuthUser) => void;
  setPersonnel: (id: string | null, record: PersonnelRecord) => void;
  setVenue: (id: string | null, info: VenueInfo) => void;
  loadAuth: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  personnelId: null,
  personnelRecord: null,
  venueId: null,
  venueInfo: null,
  loaded: false,

  setUser: (user) => set({ user }),

  setPersonnel: (personnelId, personnelRecord) => set({ personnelId, personnelRecord }),

  setVenue: (venueId, venueInfo) => set({ venueId, venueInfo }),

  loadAuth: async () => {
    if (!supabase) {
      set({ loaded: true });
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({
        user: null,
        personnelId: null,
        personnelRecord: null,
        venueId: null,
        venueInfo: null,
        loaded: true,
      });
      return;
    }
    set({ user: { id: user.id, email: user.email ?? undefined } });

    const [personnelRes, venueRes] = await Promise.all([
      supabase.from("personnel").select("id, user_id, display_name, city, postcode").eq("user_id", user.id).maybeSingle(),
      supabase.from("venues").select("id, name, user_id").eq("user_id", user.id).maybeSingle(),
    ]);

    const personnel = personnelRes.data;
    const venue = venueRes.data;

    set({
      personnelId: personnel?.id ?? null,
      personnelRecord: personnel
        ? {
            id: personnel.id,
            user_id: personnel.user_id,
            display_name: personnel.display_name ?? "Staff",
            city: personnel.city,
            postcode: personnel.postcode,
          }
        : null,
      venueId: venue?.id ?? null,
      venueInfo: venue ? { id: venue.id, name: venue.name, user_id: venue.user_id } : null,
      loaded: true,
    });
  },

  clear: () =>
    set({
      user: null,
      personnelId: null,
      personnelRecord: null,
      venueId: null,
      venueInfo: null,
      loaded: true,
    }),
}));
