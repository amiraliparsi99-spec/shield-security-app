-- 0057_geofence_polygon.sql
-- Venue/agency-drawn geofences: a polygon boundary defining the real on-site
-- area, used by check-in, mobile auto check-in and the travel-risk engine so a
-- guard who is physically on-site but far from the single check-in pin still
-- counts as present.
--
-- Storage is a GeoJSON Polygon (single outer ring of [lng, lat] pairs) in JSONB
-- — the exact shape Mapbox GL Draw emits — plus a derived centroid for fast
-- distance maths in the travel-risk "en route" rings. No PostGIS required;
-- point-in-polygon runs in JS on both web and mobile.
--
-- 1) venue_locations.geofence_polygon         — reusable site boundary (draw once)
--    venue_locations.geofence_centroid_lat/lng — derived centre for distance maths
--    venue_locations.geofence_updated_at        — when the boundary was last edited
-- 2) bookings.site_geofence_polygon            — snapshot/override for one booking

ALTER TABLE public.venue_locations
  ADD COLUMN IF NOT EXISTS geofence_polygon      jsonb,
  ADD COLUMN IF NOT EXISTS geofence_centroid_lat double precision,
  ADD COLUMN IF NOT EXISTS geofence_centroid_lng double precision,
  ADD COLUMN IF NOT EXISTS geofence_updated_at   timestamptz;

COMMENT ON COLUMN public.venue_locations.geofence_polygon IS
  'GeoJSON Polygon (single outer ring of [lng,lat] pairs) defining the on-site area. NULL = fall back to lat/lng + radius for check-in.';
COMMENT ON COLUMN public.venue_locations.geofence_centroid_lat IS
  'Derived centroid latitude of geofence_polygon, used by the travel-risk engine for en-route distance.';
COMMENT ON COLUMN public.venue_locations.geofence_centroid_lng IS
  'Derived centroid longitude of geofence_polygon, used by the travel-risk engine for en-route distance.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS site_geofence_polygon jsonb;

COMMENT ON COLUMN public.bookings.site_geofence_polygon IS
  'Snapshot/override: GeoJSON Polygon for this booking''s on-site area. NULL = fall back to the linked venue_location polygon, then to site_latitude/longitude + radius.';

-- RLS: venue_locations already grants owners full CRUD via get_my_venue_ids()
-- (see 0045_venue_locations_and_booking_site.sql), so the new columns are
-- writable by venue owners with no extra policy. Bookings keep their existing
-- policies; agencies edit site_geofence_polygon through an authorize-by-
-- assignment server route (service role), so no broad bookings UPDATE policy is
-- added here.
