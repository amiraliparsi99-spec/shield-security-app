-- Guards need to read saved-site rows when a booking points at venue_location_id but
-- site_address_text was not populated (legacy rows). Complements 0047 backfill.

DROP POLICY IF EXISTS "Venue locations select for shift visibility" ON public.venue_locations;

CREATE POLICY "Venue locations select for shift visibility" ON public.venue_locations FOR SELECT
  USING (
    id IN (
      SELECT b.venue_location_id
      FROM public.bookings b
      WHERE b.venue_location_id IS NOT NULL
        AND (
          b.id IN (SELECT public.get_my_assigned_booking_ids())
          OR b.id IN (SELECT public.get_bookings_with_open_shifts())
          OR b.id IN (SELECT public.get_my_agency_booking_ids())
        )
    )
  );

COMMENT ON POLICY "Venue locations select for shift visibility" ON public.venue_locations IS
  'Personnel/agency can read a saved site row when linked to a booking they can already see.';
