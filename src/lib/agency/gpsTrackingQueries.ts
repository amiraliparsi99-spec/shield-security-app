import type { SupabaseClient } from "@supabase/supabase-js";

export type GpsLogRow = {
  id: string;
  shift_id: string;
  personnel_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
};

export type ShiftGpsSummary = {
  shiftId: string;
  personnelId: string;
  guardName: string;
  eventName: string;
  eventDate: string;
  siteLabel: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  shiftStatus: string;
  pointCount: number;
  lastRecordedAt: string | null;
  latestLat: number | null;
  latestLng: number | null;
};

export async function getAgencyIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("agencies")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Booking ids owned by or staffed by this agency. */
export async function getAgencyScopedShiftIds(
  supabase: SupabaseClient,
  agencyId: string,
  sinceIso: string,
): Promise<string[]> {
  const [created, staffed] = await Promise.all([
    supabase.from("bookings").select("id").eq("agency_id", agencyId),
    supabase.from("shifts").select("id, booking_id").eq("agency_id", agencyId),
  ]);

  const bookingIds = new Set<string>(
    ((created.data as { id: string }[] | null) ?? []).map((b) => b.id),
  );

  const staffedShiftIds: string[] = [];
  for (const row of (staffed.data as { id: string; booking_id: string | null }[] | null) ?? []) {
    staffedShiftIds.push(row.id);
    if (row.booking_id) bookingIds.add(row.booking_id);
  }

  if (bookingIds.size === 0 && staffedShiftIds.length === 0) return [];

  let shiftQuery = supabase
    .from("shifts")
    .select("id")
    .gte("scheduled_start", sinceIso);

  if (bookingIds.size > 0) {
    shiftQuery = shiftQuery.in("booking_id", Array.from(bookingIds));
  } else {
    shiftQuery = shiftQuery.in("id", staffedShiftIds);
  }

  const { data: shifts } = await shiftQuery;
  const ids = new Set<string>(staffedShiftIds);
  for (const s of (shifts as { id: string }[] | null) ?? []) {
    ids.add(s.id);
  }
  return Array.from(ids);
}

export async function fetchAgencyShiftGpsSummaries(
  supabase: SupabaseClient,
  agencyId: string,
  sinceIso: string,
): Promise<ShiftGpsSummary[]> {
  const shiftIds = await getAgencyScopedShiftIds(supabase, agencyId, sinceIso);
  if (shiftIds.length === 0) return [];

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select(
      `
      id,
      status,
      scheduled_start,
      scheduled_end,
      personnel_id,
      personnel:personnel_id ( id, display_name ),
      booking:bookings (
        event_name,
        event_date,
        site_label
      )
    `,
    )
    .in("id", shiftIds)
    .not("personnel_id", "is", null)
    .order("scheduled_start", { ascending: false });

  if (shiftsError || !shifts?.length) return [];

  const { data: gpsRows, error: gpsError } = await supabase
    .from("shift_gps_log")
    .select("shift_id, personnel_id, lat, lng, recorded_at")
    .in("shift_id", shiftIds)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: false });

  if (gpsError) {
    console.error("[gpsTracking] shift_gps_log query failed:", gpsError.message);
    return [];
  }

  const byShift = new Map<
    string,
    { count: number; last: string; lat: number; lng: number }
  >();
  for (const row of (gpsRows as GpsLogRow[] | null) ?? []) {
    if (byShift.has(row.shift_id)) {
      const cur = byShift.get(row.shift_id)!;
      cur.count += 1;
    } else {
      byShift.set(row.shift_id, {
        count: 1,
        last: row.recorded_at,
        lat: row.lat,
        lng: row.lng,
      });
    }
  }

  return (shifts as any[]).map((s) => {
    const booking = Array.isArray(s.booking) ? s.booking[0] : s.booking;
    const personnel = Array.isArray(s.personnel) ? s.personnel[0] : s.personnel;
    const gps = byShift.get(s.id);
    return {
      shiftId: s.id,
      personnelId: s.personnel_id as string,
      guardName: personnel?.display_name ?? "Guard",
      eventName: booking?.event_name ?? "Shift",
      eventDate: booking?.event_date ?? "",
      siteLabel: booking?.site_label ?? null,
      scheduledStart: s.scheduled_start,
      scheduledEnd: s.scheduled_end,
      shiftStatus: s.status,
      pointCount: gps?.count ?? 0,
      lastRecordedAt: gps?.last ?? null,
      latestLat: gps?.lat ?? null,
      latestLng: gps?.lng ?? null,
    } satisfies ShiftGpsSummary;
  });
}

export async function fetchPersonnelGpsHistory(
  supabase: SupabaseClient,
  agencyId: string,
  personnelId: string,
  sinceIso: string,
): Promise<{ logs: GpsLogRow[]; shifts: ShiftGpsSummary[] }> {
  const shiftIds = await getAgencyScopedShiftIds(supabase, agencyId, sinceIso);
  if (shiftIds.length === 0) return { logs: [], shifts: [] };

  const { data: personnelShifts } = await supabase
    .from("shifts")
    .select("id")
    .in("id", shiftIds)
    .eq("personnel_id", personnelId);

  const pShiftIds = ((personnelShifts as { id: string }[] | null) ?? []).map((s) => s.id);
  if (pShiftIds.length === 0) return { logs: [], shifts: [] };

  const { data: logs, error } = await supabase
    .from("shift_gps_log")
    .select("id, shift_id, personnel_id, lat, lng, accuracy, recorded_at")
    .in("shift_id", pShiftIds)
    .eq("personnel_id", personnelId)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[gpsTracking] personnel history failed:", error.message);
    return { logs: [], shifts: [] };
  }

  const summaries = await fetchAgencyShiftGpsSummaries(supabase, agencyId, sinceIso);
  return {
    logs: (logs as GpsLogRow[]) ?? [],
    shifts: summaries.filter((s) => s.personnelId === personnelId),
  };
}
