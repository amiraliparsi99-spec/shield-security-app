-- 0055 — Persist signup-time permission state
--
-- Captured at the end of signup so we know whether each user accepted the
-- OS-level prompts for push notifications and (for personnel) location.
-- These are advisory columns; runtime tracking still queries the OS each
-- time, but having them in the DB lets the venue dashboard surface
-- "this guard hasn't enabled Always location" warnings, and lets ops nudge
-- non-compliant guards via support flows.

-- Notifications: applies to all signup roles
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS notifications_granted_at timestamptz NULL;
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS notifications_granted_at timestamptz NULL;
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS notifications_granted_at timestamptz NULL;

-- Location: personnel only (venues + agencies don't get tracked)
-- Allowed values:
--   'always'       — iOS "Always" / Android background granted
--   'while_using'  — iOS "While Using" / Android foreground only
--   'denied'       — user denied or restricted
--   NULL           — never asked (legacy rows)
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS location_permission text NULL;
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS location_granted_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'personnel_location_permission_chk'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_location_permission_chk
      CHECK (location_permission IS NULL OR location_permission IN ('always','while_using','denied'));
  END IF;
END$$;

COMMENT ON COLUMN public.personnel.notifications_granted_at
  IS 'Set at signup when guard granted iOS/Android push notification permission. Cleared if revoked.';
COMMENT ON COLUMN public.venues.notifications_granted_at
  IS 'Set at signup when venue contact granted push notification permission.';
COMMENT ON COLUMN public.agencies.notifications_granted_at
  IS 'Set at signup when agency contact granted push notification permission.';
COMMENT ON COLUMN public.personnel.location_permission
  IS 'Last known iOS/Android location authorization level: always | while_using | denied.';
COMMENT ON COLUMN public.personnel.location_granted_at
  IS 'Timestamp the guard most recently granted location (any level). Used for compliance audits.';
