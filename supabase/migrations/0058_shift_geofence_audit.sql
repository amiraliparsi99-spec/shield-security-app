-- 0058_shift_geofence_audit.sql
-- Records HOW a check-in/out passed the geofence so attendance is provable in a
-- dispute: was the guard inside a drawn polygon, within the pin radius, or was
-- no geofence configured — and how far from the boundary/pin they were.
--
--   *_geofence_mode  — 'polygon' | 'radius' | 'none'
--   *_distance_m     — metres to the polygon edge (0 inside) or to the pin

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS check_in_geofence_mode  text,
  ADD COLUMN IF NOT EXISTS check_in_distance_m     integer,
  ADD COLUMN IF NOT EXISTS check_out_geofence_mode text,
  ADD COLUMN IF NOT EXISTS check_out_distance_m    integer;

COMMENT ON COLUMN public.shifts.check_in_geofence_mode IS
  'How the check-in geofence was evaluated: polygon (inside drawn boundary), radius (within pin radius), or none (no geofence configured).';
COMMENT ON COLUMN public.shifts.check_in_distance_m IS
  'Metres from the geofence at check-in: distance to the polygon edge (0 = inside) for polygon mode, or to the check-in pin for radius mode.';
COMMENT ON COLUMN public.shifts.check_out_geofence_mode IS
  'Same as check_in_geofence_mode, captured at checkout.';
COMMENT ON COLUMN public.shifts.check_out_distance_m IS
  'Same as check_in_distance_m, captured at checkout.';
