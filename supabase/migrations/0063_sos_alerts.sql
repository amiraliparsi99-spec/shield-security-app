-- 0063_sos_alerts.sql
-- Lone-worker safety: a guard can raise an SOS/panic alert from their phone.
-- The alert captures their live location and is surfaced to the venue (and the
-- assigned agency) so they can respond. Resolvable once handled.

CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id  uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  shift_id      uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  booking_id    uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  venue_id      uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  lat           double precision,
  lng           double precision,
  note          text,
  status        text NOT NULL DEFAULT 'active',   -- 'active' | 'resolved'
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_venue_status
  ON public.sos_alerts(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_personnel
  ON public.sos_alerts(personnel_id);

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SOS service role"    ON public.sos_alerts;
DROP POLICY IF EXISTS "SOS guard insert"    ON public.sos_alerts;
DROP POLICY IF EXISTS "SOS guard read"      ON public.sos_alerts;
DROP POLICY IF EXISTS "SOS venue read"      ON public.sos_alerts;
DROP POLICY IF EXISTS "SOS venue update"    ON public.sos_alerts;
DROP POLICY IF EXISTS "SOS agency read"     ON public.sos_alerts;

CREATE POLICY "SOS service role" ON public.sos_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Guard raises + reads their own alerts.
CREATE POLICY "SOS guard insert" ON public.sos_alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

CREATE POLICY "SOS guard read" ON public.sos_alerts
  FOR SELECT TO authenticated
  USING (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

-- Venue sees + resolves alerts for its own venues.
CREATE POLICY "SOS venue read" ON public.sos_alerts
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "SOS venue update" ON public.sos_alerts
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

-- Agency sees alerts for shifts it provides.
CREATE POLICY "SOS agency read" ON public.sos_alerts
  FOR SELECT TO authenticated
  USING (
    shift_id IN (
      SELECT s.id FROM public.shifts s
      JOIN public.agencies a ON a.id = s.agency_id
      WHERE a.user_id = auth.uid()
    )
  );
