-- Populate site_address_text from saved venue_locations where the snapshot was never stored
-- (e.g. bookings created before site_address_text existed).

UPDATE public.bookings b
SET site_address_text = TRIM(
  CONCAT_WS(
    ', ',
    NULLIF(TRIM(vl.address_line1), ''),
    NULLIF(TRIM(vl.city), ''),
    NULLIF(TRIM(vl.postcode), '')
  )
)
FROM public.venue_locations vl
WHERE b.venue_location_id = vl.id
  AND (b.site_address_text IS NULL OR TRIM(b.site_address_text) = '')
  AND (
    NULLIF(TRIM(vl.address_line1), '') IS NOT NULL
    OR NULLIF(TRIM(vl.city), '') IS NOT NULL
    OR NULLIF(TRIM(vl.postcode), '') IS NOT NULL
  );

-- If we still have no text but have a label on the saved site, use label as last resort.
UPDATE public.bookings b
SET site_address_text = TRIM(vl.label)
FROM public.venue_locations vl
WHERE b.venue_location_id = vl.id
  AND (b.site_address_text IS NULL OR TRIM(b.site_address_text) = '')
  AND NULLIF(TRIM(vl.label), '') IS NOT NULL;

-- Custom site (coords differ from venue profile) but no address snapshot — avoid showing HQ address.
UPDATE public.bookings b
SET site_address_text = TRIM(b.site_label)
FROM public.venues v
WHERE b.venue_id = v.id
  AND v.latitude IS NOT NULL
  AND v.longitude IS NOT NULL
  AND b.site_latitude IS NOT NULL
  AND b.site_longitude IS NOT NULL
  AND (b.site_address_text IS NULL OR TRIM(b.site_address_text) = '')
  AND TRIM(COALESCE(b.site_label, '')) NOT ILIKE '%main account address%'
  AND TRIM(COALESCE(b.site_label, '')) <> ''
  AND (
    ABS(b.site_latitude::double precision - v.latitude::double precision) > 0.0005
    OR ABS(b.site_longitude::double precision - v.longitude::double precision) > 0.0005
  );
