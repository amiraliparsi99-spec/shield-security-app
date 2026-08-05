-- 0068_agency_scheduled_shifts.sql
-- Agency Shift Scheduler.
--
-- Lets an existing agency schedule its OWN roster staff for shifts WITHOUT
-- going through Stripe escrow (the agency pays its own staff). Each assignment
-- is something the guard then Accepts or Declines from the mobile app.
--
--   1. bookings.self_managed  — marks no-escrow agency-scheduled bookings so the
--      escrow/confirm/payment logic can skip them.
--   2. shift_assignments      — the assignment lifecycle (pending -> accepted |
--      declined | cancelled). Display fields are denormalized onto the row so
--      the mobile "My Scheduled Shifts" list needs no joins or extra RLS on
--      bookings/shifts.

-- ── 1. Self-managed (no escrow) bookings ────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS self_managed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.self_managed IS
  'True for agency-scheduled roster bookings that skip Stripe escrow — the agency pays its own staff.';

-- ── 2. Assignment lifecycle ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),

  -- Denormalized display fields (guard's mobile list reads only this table).
  event_name TEXT,
  role TEXT,
  hourly_rate NUMERIC,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  location_text TEXT,
  agency_name TEXT,

  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (shift_id, personnel_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_personnel_status
  ON public.shift_assignments(personnel_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_agency
  ON public.shift_assignments(agency_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift
  ON public.shift_assignments(shift_id);

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Mutations primarily run through service-role API routes; these policies are a
-- backstop and power direct client reads (the mobile list + the web scheduler).

-- Agency owner manages assignments for its own agency.
DO $$
BEGIN
  CREATE POLICY "agency_select_assignments" ON public.shift_assignments
    FOR SELECT USING (agency_id = public.get_my_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "agency_insert_assignments" ON public.shift_assignments
    FOR INSERT WITH CHECK (agency_id = public.get_my_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "agency_update_assignments" ON public.shift_assignments
    FOR UPDATE USING (agency_id = public.get_my_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Assigned guard can see + respond to their own assignments.
DO $$
BEGIN
  CREATE POLICY "personnel_select_own_assignments" ON public.shift_assignments
    FOR SELECT USING (
      personnel_id IN (
        SELECT id FROM public.personnel WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "personnel_update_own_assignments" ON public.shift_assignments
    FOR UPDATE USING (
      personnel_id IN (
        SELECT id FROM public.personnel WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.shift_assignments IS
  'Agency-initiated assignment of a roster guard to a shift, which the guard accepts or declines.';
