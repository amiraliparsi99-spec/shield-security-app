import type { SupabaseClient } from "@supabase/supabase-js";

export type AgencyBookingAccess = "owner" | "assigned";

export type AgencyBookingRow = {
  id: string;
  agency_id: string | null;
  venue_id: string | null;
  status: string;
  self_managed?: boolean | null;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  brief_notes: string | null;
  site_label: string | null;
  site_address_text: string | null;
  site_latitude: number | null;
  site_longitude: number | null;
};

export interface AgencyBookingContext {
  agency: { id: string; name: string };
  booking: AgencyBookingRow;
  access: AgencyBookingAccess;
}

/** Build scheduled start/end from booking date + HH:mm times. */
export function scheduledRangeFromBooking(
  eventDate: string,
  startTime: string,
  endTime: string,
): { scheduledStart: Date; scheduledEnd: Date } {
  const base = new Date(eventDate);
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const scheduledStart = new Date(base);
  scheduledStart.setHours(startH, startM, 0, 0);
  const scheduledEnd = new Date(base);
  scheduledEnd.setHours(endH, endM, 0, 0);
  if (scheduledEnd <= scheduledStart) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }
  return { scheduledStart, scheduledEnd };
}

export async function resolveAgencyBookingContext(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string,
): Promise<AgencyBookingContext | null> {
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!agency) return null;

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, agency_id, venue_id, status, self_managed, event_name, event_date, start_time, end_time, brief_notes, site_label, site_address_text, site_latitude, site_longitude",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) return null;

  if (booking.agency_id === agency.id) {
    return { agency, booking: booking as AgencyBookingRow, access: "owner" };
  }

  const { data: agencyShift } = await supabase
    .from("shifts")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("agency_id", agency.id)
    .limit(1)
    .maybeSingle();

  if (agencyShift) {
    return { agency, booking: booking as AgencyBookingRow, access: "assigned" };
  }

  return null;
}

export async function resolveAgencyShiftContext(
  supabase: SupabaseClient,
  userId: string,
  shiftId: string,
): Promise<(AgencyBookingContext & { shift: { id: string; agency_id: string | null; status: string; personnel_id: string | null } }) | null> {
  const { data: shift } = await supabase
    .from("shifts")
    .select("id, booking_id, agency_id, status, personnel_id")
    .eq("id", shiftId)
    .maybeSingle();

  if (!shift) return null;

  const ctx = await resolveAgencyBookingContext(supabase, userId, shift.booking_id);
  if (!ctx) return null;

  if (ctx.access === "assigned" && shift.agency_id !== ctx.agency.id) {
    return null;
  }

  return { ...ctx, shift };
}
