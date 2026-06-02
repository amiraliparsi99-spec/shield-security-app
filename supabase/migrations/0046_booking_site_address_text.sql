-- Human-readable address for the booking site (snapshot at job creation) so guards see
-- where to go even when it differs from the venue account's registered address.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS site_address_text TEXT;

COMMENT ON COLUMN public.bookings.site_address_text IS
  'Snapshot: full address lines for this job (may differ from venues.address_*).';
