-- 0066_agency_bookings.sql
-- Agencies can create bookings just like venues. A booking is owned by either
-- a venue (venue_id) or an agency (agency_id) — never neither. Agency bookings
-- use the ad-hoc site fields (site_label / site_latitude / ...) since
-- venue_locations belongs to venues.

ALTER TABLE public.bookings
  ALTER COLUMN venue_id DROP NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_owner_present_check'
    AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_owner_present_check
    CHECK (venue_id IS NOT NULL OR agency_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_agency
ON public.bookings(agency_id)
WHERE agency_id IS NOT NULL;

-- ── RLS: agencies manage their own bookings ──────────────────────────────────

DO $$
BEGIN
  CREATE POLICY "agency_insert_bookings" ON public.bookings
    FOR INSERT WITH CHECK (agency_id = public.get_my_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "agency_select_bookings" ON public.bookings
    FOR SELECT USING (agency_id = public.get_my_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "agency_update_bookings" ON public.bookings
    FOR UPDATE USING (agency_id = public.get_my_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RLS: agencies manage shifts under their own bookings ────────────────────
-- Mirrors the venue policies ("Venues can view/update their shifts",
-- "shifts_venue_insert") for agency-owned bookings.

DO $$
BEGIN
  CREATE POLICY "agency_insert_shifts" ON public.shifts
    FOR INSERT WITH CHECK (
      booking_id IN (
        SELECT id FROM public.bookings WHERE agency_id = public.get_my_agency_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "agency_select_own_booking_shifts" ON public.shifts
    FOR SELECT USING (
      booking_id IN (
        SELECT id FROM public.bookings WHERE agency_id = public.get_my_agency_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "agency_update_own_booking_shifts" ON public.shifts
    FOR UPDATE USING (
      booking_id IN (
        SELECT id FROM public.bookings WHERE agency_id = public.get_my_agency_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.bookings.agency_id IS 'Owning agency when the booking was created by an agency (mutually optional with venue_id; one must be set)';
