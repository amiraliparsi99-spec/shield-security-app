/** Minutes before scheduled_start when live GPS tracking may begin. */
export const GPS_TRACKING_LEAD_MINUTES = 60;

/** Grace after scheduled_end before we treat a shift as no longer live-trackable. */
export const GPS_TRACKING_END_GRACE_MS = 2 * 60 * 1000;

type TrackableShift = {
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  personnel_id?: string | null;
};

export function isShiftLiveTrackable(
  shift: TrackableShift,
  nowMs: number = Date.now(),
): boolean {
  if (!shift.personnel_id) return false;
  const trackable =
    shift.status === "accepted" ||
    shift.status === "checked_in" ||
    (shift.status === "pending" && !!shift.personnel_id);
  if (!trackable) return false;

  const startMs = new Date(shift.scheduled_start).getTime();
  const endMs = new Date(shift.scheduled_end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;

  const earliestMs = startMs - GPS_TRACKING_LEAD_MINUTES * 60_000;
  const latestMs = endMs + GPS_TRACKING_END_GRACE_MS;
  return nowMs >= earliestMs && nowMs <= latestMs;
}

export function isGpsPointLiveForShift(
  shift: TrackableShift,
  recordedAt: string,
  nowMs: number = Date.now(),
): boolean {
  if (!isShiftLiveTrackable(shift, nowMs)) return false;

  const recordedMs = new Date(recordedAt).getTime();
  const startMs = new Date(shift.scheduled_start).getTime();
  const endMs = new Date(shift.scheduled_end).getTime();
  if (!Number.isFinite(recordedMs) || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return false;
  }

  const earliestMs = startMs - GPS_TRACKING_LEAD_MINUTES * 60_000;
  const latestMs = endMs + GPS_TRACKING_END_GRACE_MS;
  return recordedMs >= earliestMs && recordedMs <= latestMs;
}
