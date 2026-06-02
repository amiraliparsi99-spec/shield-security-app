-- Ensure mission-control auto-membership runs for both INSERT and UPDATE assignments.

CREATE OR REPLACE FUNCTION public.add_to_mission_control_on_shift_assign()
RETURNS TRIGGER AS $$
DECLARE
  v_chat_id UUID;
  v_personnel RECORD;
  v_should_add BOOLEAN := FALSE;
BEGIN
  -- INSERT with pre-assigned personnel.
  IF TG_OP = 'INSERT' AND NEW.personnel_id IS NOT NULL THEN
    v_should_add := TRUE;
  END IF;

  -- UPDATE when personnel is newly assigned or reassigned.
  IF TG_OP = 'UPDATE'
     AND NEW.personnel_id IS NOT NULL
     AND (OLD.personnel_id IS NULL OR OLD.personnel_id != NEW.personnel_id) THEN
    v_should_add := TRUE;
  END IF;

  IF v_should_add THEN
    SELECT id INTO v_chat_id
    FROM public.group_chats
    WHERE booking_id = NEW.booking_id AND chat_type = 'mission_control';

    IF v_chat_id IS NULL THEN
      v_chat_id := public.create_mission_control_chat(NEW.booking_id);
    END IF;

    IF v_chat_id IS NOT NULL THEN
      SELECT p.user_id, p.display_name
      INTO v_personnel
      FROM public.personnel p
      WHERE p.id = NEW.personnel_id;

      IF v_personnel.user_id IS NOT NULL THEN
        INSERT INTO public.group_chat_members (group_chat_id, user_id, role, display_name)
        VALUES (v_chat_id, v_personnel.user_id, 'member', v_personnel.display_name)
        ON CONFLICT (group_chat_id, user_id) DO NOTHING;

        INSERT INTO public.group_chat_messages (group_chat_id, sender_id, content, message_type)
        VALUES (
          v_chat_id,
          v_personnel.user_id,
          COALESCE(v_personnel.display_name, 'Team member') || ' has joined the security team',
          'system'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_add_to_mission_control ON public.shifts;
CREATE TRIGGER trigger_add_to_mission_control
  AFTER INSERT OR UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.add_to_mission_control_on_shift_assign();
