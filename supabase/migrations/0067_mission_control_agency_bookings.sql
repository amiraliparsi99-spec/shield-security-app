-- Fix: Mission Control chat creation crashed for agency-owned bookings.
--
-- create_mission_control_chat() INNER JOINed venues on bookings.venue_id and
-- raised 'Booking not found' when no venue row matched. Agency-owned bookings
-- carry agency_id (venue_id IS NULL), so the join was empty and the function
-- raised — which, because it runs inside the AFTER UPDATE trigger on shifts
-- (trigger_add_to_mission_control), aborted every shift claim on an agency
-- booking. The claim API then surfaced this as "already claimed".
--
-- This rewrite LEFT JOINs both venues and agencies and resolves the owning
-- party (venue first, else agency) so chats are created for either owner type.

CREATE OR REPLACE FUNCTION public.create_mission_control_chat(
  p_booking_id UUID
) RETURNS UUID AS $$
DECLARE
  v_chat_id UUID;
  v_booking RECORD;
  v_owner_user_id UUID;
  v_owner_name TEXT;
  v_owner_venue_id UUID;
  v_shift RECORD;
  v_personnel RECORD;
BEGIN
  -- Load booking with optional venue + agency owner details. LEFT JOINs ensure
  -- agency bookings (venue_id IS NULL) are still found.
  SELECT
    b.*,
    v.name    AS venue_name,
    v.id      AS v_id,
    v.user_id AS venue_owner_id,
    a.name    AS agency_name,
    a.user_id AS agency_owner_id
  INTO v_booking
  FROM public.bookings b
  LEFT JOIN public.venues v   ON b.venue_id  = v.id
  LEFT JOIN public.agencies a ON b.agency_id = a.id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Resolve the owning party: venue if present, otherwise the agency.
  IF v_booking.venue_owner_id IS NOT NULL THEN
    v_owner_user_id  := v_booking.venue_owner_id;
    v_owner_name     := COALESCE(v_booking.venue_name, 'Venue');
    v_owner_venue_id := v_booking.v_id;
  ELSE
    v_owner_user_id  := v_booking.agency_owner_id;
    v_owner_name     := COALESCE(v_booking.agency_name, 'Agency');
    v_owner_venue_id := NULL;
  END IF;

  -- Return existing chat if one already exists for this booking.
  SELECT id INTO v_chat_id
  FROM public.group_chats
  WHERE booking_id = p_booking_id AND chat_type = 'mission_control';

  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  -- Create the group chat.
  INSERT INTO public.group_chats (
    name,
    booking_id,
    venue_id,
    chat_type,
    created_by,
    event_date,
    metadata
  ) VALUES (
    v_booking.event_name || ' - Security Team',
    p_booking_id,
    v_owner_venue_id,
    'mission_control',
    v_owner_user_id,
    v_booking.event_date::date,
    jsonb_build_object(
      'event_name', v_booking.event_name,
      'venue_name', v_owner_name,
      'start_time', v_booking.start_time,
      'end_time', v_booking.end_time
    )
  ) RETURNING id INTO v_chat_id;

  -- Add the owner (venue or agency) as chat owner, when we have a user id.
  IF v_owner_user_id IS NOT NULL THEN
    INSERT INTO public.group_chat_members (group_chat_id, user_id, role, display_name)
    VALUES (v_chat_id, v_owner_user_id, 'owner', v_owner_name)
    ON CONFLICT (group_chat_id, user_id) DO NOTHING;
  END IF;

  -- Add all assigned personnel as members.
  FOR v_shift IN
    SELECT s.personnel_id
    FROM public.shifts s
    WHERE s.booking_id = p_booking_id
    AND s.personnel_id IS NOT NULL
  LOOP
    SELECT p.user_id, p.display_name
    INTO v_personnel
    FROM public.personnel p
    WHERE p.id = v_shift.personnel_id;

    IF v_personnel.user_id IS NOT NULL THEN
      INSERT INTO public.group_chat_members (group_chat_id, user_id, role, display_name)
      VALUES (v_chat_id, v_personnel.user_id, 'member', v_personnel.display_name)
      ON CONFLICT (group_chat_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Welcome system message (only if we have a sender user id).
  IF v_owner_user_id IS NOT NULL THEN
    INSERT INTO public.group_chat_messages (group_chat_id, sender_id, content, message_type)
    VALUES (
      v_chat_id,
      v_owner_user_id,
      '🛡️ Mission Control activated for ' || v_booking.event_name || '. All team members are connected. Share updates, locations, and coordinate here.',
      'system'
    );
  END IF;

  RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_mission_control_chat(UUID) TO authenticated;
