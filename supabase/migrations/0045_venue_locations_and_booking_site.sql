-- Saved physical sites per venue account + snapshot on each booking for check-in geofence.

CREATE TABLE IF NOT EXISTS public.venue_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_line1 TEXT,
  city TEXT,
  postcode TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_locations_venue_id ON public.venue_locations(venue_id);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS venue_location_id UUID REFERENCES public.venue_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_label TEXT,
  ADD COLUMN IF NOT EXISTS site_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS site_longitude DOUBLE PRECISION;

COMMENT ON TABLE public.venue_locations IS 'Reusable sites (e.g. chain branches) for a venue; bookings snapshot coords for check-in.';
COMMENT ON COLUMN public.bookings.venue_location_id IS 'Optional FK to saved site used when creating this booking.';
COMMENT ON COLUMN public.bookings.site_label IS 'Snapshot: display name for guards / geofence (immutable after booking).';
COMMENT ON COLUMN public.bookings.site_latitude IS 'Snapshot: check-in geofence latitude for this booking.';
COMMENT ON COLUMN public.bookings.site_longitude IS 'Snapshot: check-in geofence longitude for this booking.';

ALTER TABLE public.venue_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venue locations select own" ON public.venue_locations;
DROP POLICY IF EXISTS "Venue locations insert own" ON public.venue_locations;
DROP POLICY IF EXISTS "Venue locations update own" ON public.venue_locations;
DROP POLICY IF EXISTS "Venue locations delete own" ON public.venue_locations;
DROP POLICY IF EXISTS "Venue locations admin" ON public.venue_locations;

CREATE POLICY "Venue locations select own" ON public.venue_locations FOR SELECT
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Venue locations insert own" ON public.venue_locations FOR INSERT
  WITH CHECK (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Venue locations update own" ON public.venue_locations FOR UPDATE
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Venue locations delete own" ON public.venue_locations FOR DELETE
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Venue locations admin" ON public.venue_locations FOR ALL
  USING (public.is_admin());
