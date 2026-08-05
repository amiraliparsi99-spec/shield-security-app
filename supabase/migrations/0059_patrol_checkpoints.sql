-- 0059_patrol_checkpoints.sql
-- Patrol checkpoints: named points a venue/agency places inside the on-site
-- zone (e.g. fire exit, main door, perimeter corner). A guard "visits" a
-- checkpoint when their GPS comes within radius_m during their shift — giving
-- proof-of-presence at specific posts, not just "phone was on site".
--
-- GPS-proximity based (no QR/NFC hardware needed). QR scanning can layer on
-- later by adding a token column + scan endpoint.

CREATE TABLE IF NOT EXISTS public.booking_checkpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  label       text NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  radius_m    integer NOT NULL DEFAULT 30,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_checkpoints_booking
  ON public.booking_checkpoints(booking_id);

CREATE TABLE IF NOT EXISTS public.checkpoint_visits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL REFERENCES public.booking_checkpoints(id) ON DELETE CASCADE,
  shift_id      uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  personnel_id  uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  lat           double precision,
  lng           double precision,
  visited_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkpoint_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_visits_shift
  ON public.checkpoint_visits(shift_id);

ALTER TABLE public.booking_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_visits  ENABLE ROW LEVEL SECURITY;

-- ── booking_checkpoints policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "Checkpoints service role"  ON public.booking_checkpoints;
DROP POLICY IF EXISTS "Checkpoints venue manage"  ON public.booking_checkpoints;
DROP POLICY IF EXISTS "Checkpoints agency manage" ON public.booking_checkpoints;
DROP POLICY IF EXISTS "Checkpoints guard read"    ON public.booking_checkpoints;

CREATE POLICY "Checkpoints service role" ON public.booking_checkpoints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Venue that owns the booking: full control.
CREATE POLICY "Checkpoints venue manage" ON public.booking_checkpoints
  FOR ALL TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM public.bookings b
      WHERE b.venue_id IN (SELECT public.get_my_venue_ids())
    )
  )
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM public.bookings b
      WHERE b.venue_id IN (SELECT public.get_my_venue_ids())
    )
  );

-- Agency assigned to provide the booking (via shifts.agency_id): full control.
CREATE POLICY "Checkpoints agency manage" ON public.booking_checkpoints
  FOR ALL TO authenticated
  USING (
    booking_id IN (
      SELECT s.booking_id FROM public.shifts s
      JOIN public.agencies a ON a.id = s.agency_id
      WHERE a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    booking_id IN (
      SELECT s.booking_id FROM public.shifts s
      JOIN public.agencies a ON a.id = s.agency_id
      WHERE a.user_id = auth.uid()
    )
  );

-- Assigned guard: read-only (so the app can show them the patrol route).
CREATE POLICY "Checkpoints guard read" ON public.booking_checkpoints
  FOR SELECT TO authenticated
  USING (
    booking_id IN (
      SELECT s.booking_id FROM public.shifts s
      JOIN public.personnel pe ON pe.id = s.personnel_id
      WHERE pe.user_id = auth.uid()
    )
  );

-- ── checkpoint_visits policies ────────────────────────────────────────────
DROP POLICY IF EXISTS "Visits service role"   ON public.checkpoint_visits;
DROP POLICY IF EXISTS "Visits guard insert"   ON public.checkpoint_visits;
DROP POLICY IF EXISTS "Visits guard read"     ON public.checkpoint_visits;
DROP POLICY IF EXISTS "Visits venue read"     ON public.checkpoint_visits;
DROP POLICY IF EXISTS "Visits agency read"    ON public.checkpoint_visits;

CREATE POLICY "Visits service role" ON public.checkpoint_visits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Guard logs their own visits.
CREATE POLICY "Visits guard insert" ON public.checkpoint_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

CREATE POLICY "Visits guard read" ON public.checkpoint_visits
  FOR SELECT TO authenticated
  USING (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

-- Venue reads visits for its bookings.
CREATE POLICY "Visits venue read" ON public.checkpoint_visits
  FOR SELECT TO authenticated
  USING (
    checkpoint_id IN (
      SELECT c.id FROM public.booking_checkpoints c
      JOIN public.bookings b ON b.id = c.booking_id
      WHERE b.venue_id IN (SELECT public.get_my_venue_ids())
    )
  );

-- Agency reads visits for bookings it provides (via shifts.agency_id).
CREATE POLICY "Visits agency read" ON public.checkpoint_visits
  FOR SELECT TO authenticated
  USING (
    checkpoint_id IN (
      SELECT c.id FROM public.booking_checkpoints c
      WHERE c.booking_id IN (
        SELECT s.booking_id FROM public.shifts s
        JOIN public.agencies a ON a.id = s.agency_id
        WHERE a.user_id = auth.uid()
      )
    )
  );
