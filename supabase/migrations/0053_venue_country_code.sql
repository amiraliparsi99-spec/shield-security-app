-- International address support: store the country (ISO 3166-1 alpha-2)
-- alongside every venue and booking site so we can disambiguate addresses
-- (e.g. "Broad Street, Birmingham, GB" vs "Broad Street, ..., LU"), filter
-- the geocoder properly, and later wire up timezone / currency per country.
--
-- Defaults to 'GB' so existing rows keep their current behaviour.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS country_code CHAR(2) NOT NULL DEFAULT 'GB';

ALTER TABLE public.venue_locations
  ADD COLUMN IF NOT EXISTS country_code CHAR(2) NOT NULL DEFAULT 'GB';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS site_country_code CHAR(2);

-- Format guard: only allow ISO 3166-1 alpha-2 codes (two uppercase letters).
ALTER TABLE public.venues
  DROP CONSTRAINT IF EXISTS venues_country_code_format;
ALTER TABLE public.venues
  ADD CONSTRAINT venues_country_code_format
  CHECK (country_code ~ '^[A-Z]{2}$');

ALTER TABLE public.venue_locations
  DROP CONSTRAINT IF EXISTS venue_locations_country_code_format;
ALTER TABLE public.venue_locations
  ADD CONSTRAINT venue_locations_country_code_format
  CHECK (country_code ~ '^[A-Z]{2}$');

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_site_country_code_format;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_site_country_code_format
  CHECK (site_country_code IS NULL OR site_country_code ~ '^[A-Z]{2}$');

COMMENT ON COLUMN public.venues.country_code IS 'ISO 3166-1 alpha-2 country code for the venue address (e.g. GB, LU).';
COMMENT ON COLUMN public.venue_locations.country_code IS 'ISO 3166-1 alpha-2 country code for the saved site address.';
COMMENT ON COLUMN public.bookings.site_country_code IS 'Snapshot: ISO 3166-1 alpha-2 for the booking site at the time of booking.';
