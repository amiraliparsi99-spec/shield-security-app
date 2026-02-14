-- ============================================================
-- AI Dispatcher — Database Migration
-- Adds standby mode for personnel and urgent shift tracking
-- ============================================================

-- 1. Personnel: standby toggle
-- Guards can enable this to receive urgent last-minute shift offers
ALTER TABLE personnel
  ADD COLUMN IF NOT EXISTS is_standby BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN personnel.is_standby IS
  'When true, guard is available for urgent last-minute shift replacements at surge pay.';

-- 2. Shifts: dispatcher / urgent replacement fields
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS surge_rate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS original_personnel_id UUID REFERENCES personnel(id),
  ADD COLUMN IF NOT EXISTS dispatcher_status TEXT DEFAULT 'none';

-- Constrain dispatcher_status to valid values
ALTER TABLE shifts
  ADD CONSTRAINT chk_dispatcher_status
  CHECK (dispatcher_status IN ('none', 'at_risk', 'searching', 'replacement_found', 'failed'));

COMMENT ON COLUMN shifts.is_urgent IS
  'Flagged true when a guard no-shows and the dispatcher is searching for a replacement.';
COMMENT ON COLUMN shifts.surge_rate IS
  'Premium hourly rate offered to standby replacements (typically 1.5x base rate).';
COMMENT ON COLUMN shifts.original_personnel_id IS
  'Records the no-show guard''s ID after a replacement is assigned.';
COMMENT ON COLUMN shifts.dispatcher_status IS
  'Tracks the dispatcher lifecycle: none → at_risk → searching → replacement_found | failed.';

-- 3. Indexes for the cron watchdog query
-- The watchdog queries accepted shifts within a 30-minute window
CREATE INDEX IF NOT EXISTS idx_shifts_attendance_check
  ON shifts (status, scheduled_start)
  WHERE status = 'accepted';

-- 4. Indexes for standby personnel search
-- findReplacement() queries active, available, standby guards sorted by shield_score
CREATE INDEX IF NOT EXISTS idx_personnel_standby
  ON personnel (shield_score DESC)
  WHERE is_standby = true AND is_active = true AND is_available = true;

-- 5. Index on dispatcher_status for filtering already-handled shifts
CREATE INDEX IF NOT EXISTS idx_shifts_dispatcher_status
  ON shifts (dispatcher_status)
  WHERE dispatcher_status IS NOT NULL AND dispatcher_status != 'none';
