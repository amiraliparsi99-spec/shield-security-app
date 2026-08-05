import { create } from "zustand";
import { supabase } from "../lib/supabase";

export interface ShiftCheckin {
  id: string;
  shiftId?: string;
  booking_id: string;
  check_in_time: string | null;
  check_in_address: string | null;
  check_out_time: string | null;
  check_out_address: string | null;
  total_hours: number | null;
  status: string;
  booking?: {
    id: string;
    event_name: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue?: { name: string; address?: string };
    venue_id?: string;
    site_label?: string | null;
    site_address_text?: string | null;
    agency?: { name: string };
  };
}

interface ShiftState {
  todaysShifts: ShiftCheckin[];
  activeShift: ShiftCheckin | null;
  loading: boolean;
  setActiveShift: (shift: ShiftCheckin | null) => void;
  loadShifts: () => Promise<void>;
  clearShifts: () => void;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  todaysShifts: [],
  activeShift: null,
  loading: false,

  setActiveShift: (activeShift) => set({ activeShift }),

  loadShifts: async () => {
    set({ loading: true });
    if (!supabase) {
      set({ todaysShifts: [], activeShift: null, loading: false });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ todaysShifts: [], activeShift: null, loading: false });
      return;
    }

    const { data: personnel } = await supabase.from("personnel").select("id").eq("user_id", user.id).maybeSingle();
    if (!personnel) {
      set({ todaysShifts: [], activeShift: null, loading: false });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, booking_id, status")
      .eq("personnel_id", personnel.id);

    const shiftList = shifts ?? [];
    const bookingIds = [...new Set(shiftList.map((s: { booking_id: string }) => s.booking_id))];
    if (bookingIds.length === 0) {
      set({ todaysShifts: [], activeShift: null, loading: false });
      return;
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, event_name, event_date, start_time, end_time, venue_id, site_label, site_address_text, venue:venues(name, address_line1), agency:agencies(name)")
      .in("id", bookingIds)
      .eq("event_date", today);

    const { data: checkins } = await supabase
      .from("shift_checkins")
      .select("id, booking_id, check_in_time, check_in_address, check_out_time, check_out_address, total_hours, status")
      .eq("personnel_id", personnel.id)
      .in("booking_id", bookingIds);

    const shiftsWithBooking = shiftList
      .filter((s: any) => (bookings ?? []).some((b: any) => b.id === s.booking_id))
      .map((s: any) => {
        const booking = (bookings ?? []).find((b: any) => b.id === s.booking_id);
        const checkin = (checkins ?? []).find((c: any) => c.booking_id === s.booking_id);
        return {
          id: checkin?.id ?? s.id,
          shiftId: s.id,
          booking_id: s.booking_id,
          check_in_time: checkin?.check_in_time ?? null,
          check_in_address: checkin?.check_in_address ?? null,
          check_out_time: checkin?.check_out_time ?? null,
          check_out_address: checkin?.check_out_address ?? null,
          total_hours: checkin?.total_hours ?? null,
          status: checkin?.status ?? s.status ?? "pending",
          booking: booking
            ? {
                id: booking.id,
                event_name: booking.event_name,
                event_date: booking.event_date,
                start_time: booking.start_time,
                end_time: booking.end_time,
                venue_id: booking.venue_id,
                site_label: booking.site_label,
                site_address_text: booking.site_address_text,
                venue: booking.venue
                  ? { name: booking.venue.name, address: booking.venue.address_line1 }
                  : undefined,
                agency: booking.agency ? { name: booking.agency.name } : undefined,
              }
            : undefined,
        };
      });

    const active = shiftsWithBooking.find((s) => s.status === "checked_in");
    set({
      todaysShifts: shiftsWithBooking,
      activeShift: active ?? null,
      loading: false,
    });
  },

  clearShifts: () => set({ todaysShifts: [], activeShift: null }),
}));
