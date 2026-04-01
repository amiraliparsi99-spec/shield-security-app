-- ============================================================
-- Fix shift-offer creation from mobile + booking visibility
-- ============================================================

-- 1. Personnel can see bookings that have open (unclaimed) shifts
--    so job cards can display the event name and venue.
CREATE OR REPLACE FUNCTION public.get_bookings_with_open_shifts()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT booking_id
  FROM public.shifts
  WHERE personnel_id IS NULL
    AND status = 'pending';
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_bookings_with_open_shifts() TO authenticated;

CREATE POLICY "Bookings select open shifts" ON public.bookings FOR SELECT
  USING (id IN (SELECT public.get_bookings_with_open_shifts()));

-- 2. Allow any authenticated user to INSERT shift_offers
--    (venue inserts offers after creating a booking).
CREATE POLICY "Authenticated insert shift offers" ON public.shift_offers
  FOR INSERT WITH CHECK (true);

-- 3. Supabase RPC: create offers for verified guards (runs SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.notify_guards_for_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking    RECORD;
  v_venue      RECORD;
  v_shift      RECORD;
  v_guard      RECORD;
  v_offer_rows JSONB[];
  v_expiry     TIMESTAMPTZ;
  v_label      TEXT;
  v_shift_date TEXT;
  v_start_time TEXT;
  v_end_time   TEXT;
  v_offers_created INT := 0;
BEGIN
  -- Load booking
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- Load venue
  SELECT * INTO v_venue FROM venues WHERE id = v_booking.venue_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Venue not found');
  END IF;

  -- Pick representative unassigned shift
  SELECT * INTO v_shift
  FROM shifts
  WHERE booking_id = p_booking_id
    AND personnel_id IS NULL
    AND status = 'pending'
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'No unassigned shifts', 'guards_notified', 0);
  END IF;

  v_expiry     := NOW() + INTERVAL '60 seconds';
  v_label      := COALESCE(v_booking.event_name, 'Security Shift') || ' @ ' || COALESCE(v_venue.name, 'Venue');
  v_shift_date := TO_CHAR(v_shift.scheduled_start, 'Dy DD Mon');
  v_start_time := TO_CHAR(v_shift.scheduled_start, 'HH24:MI');
  v_end_time   := TO_CHAR(v_shift.scheduled_end,   'HH24:MI');

  -- Find verified, active guards (up to 30)
  FOR v_guard IN
    SELECT p.id AS personnel_id, p.user_id, p.latitude, p.longitude
    FROM personnel p
    INNER JOIN verifications v ON v.owner_type = 'personnel'
                               AND v.owner_id  = p.id
                               AND v.status     = 'verified'
    WHERE p.is_active = true
    ORDER BY p.shield_score DESC NULLS LAST
    LIMIT 30
  LOOP
    BEGIN
      INSERT INTO shift_offers (
        shift_id, personnel_id, status, hourly_rate,
        venue_name, venue_address,
        venue_latitude, venue_longitude,
        shift_date, start_time, end_time,
        expires_at
      ) VALUES (
        v_shift.id, v_guard.personnel_id, 'pending', v_shift.hourly_rate,
        v_label,
        CONCAT_WS(', ', v_venue.address_line1, v_venue.city, v_venue.postcode),
        v_venue.latitude, v_venue.longitude,
        v_shift_date, v_start_time, v_end_time,
        v_expiry
      )
      ON CONFLICT (shift_id, personnel_id) DO NOTHING;

      v_offers_created := v_offers_created + 1;
    EXCEPTION WHEN OTHERS THEN
      -- skip this guard if insert fails
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'guards_notified', v_offers_created,
    'booking_id', p_booking_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_guards_for_booking(UUID) TO authenticated;
