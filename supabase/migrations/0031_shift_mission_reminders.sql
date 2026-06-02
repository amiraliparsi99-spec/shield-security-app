-- Dedupe automated Mission Control shift reminders (cron sends once per kind per shift)
CREATE TABLE IF NOT EXISTS public.shift_mission_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  reminder_kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, reminder_kind)
);

CREATE INDEX IF NOT EXISTS idx_shift_mission_reminders_shift
  ON public.shift_mission_reminders(shift_id);

COMMENT ON TABLE public.shift_mission_reminders IS 'Tracks automated Mission Control messages so cron does not duplicate';

ALTER TABLE public.shift_mission_reminders ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated users; only service role (cron) writes
