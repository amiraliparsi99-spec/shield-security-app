-- Job Board Style RLS: Allow guards to claim open shifts
-- This enables the Uber/DoorDash style "claim shift" functionality

-- Allow all authenticated users to view available (unassigned) shifts
CREATE POLICY "Anyone can view available shifts" ON public.shifts
  FOR SELECT USING (
    personnel_id IS NULL  -- Open shifts visible to all
    OR personnel_id = (SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1) -- Own shifts
  );

-- Allow personnel to claim (update) shifts that are currently unassigned
CREATE POLICY "Personnel can claim open shifts" ON public.shifts
  FOR UPDATE USING (
    -- Can only claim if shift is currently unassigned
    personnel_id IS NULL
    -- And user is active personnel
    AND EXISTS (
      SELECT 1 FROM public.personnel 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  )
  WITH CHECK (
    -- Can only set personnel_id to their own ID
    personnel_id = (SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1)
  );

-- Make sure personnel can always see and update their own shifts
DROP POLICY IF EXISTS "shifts_personnel_select" ON public.shifts;
DROP POLICY IF EXISTS "shifts_personnel_update" ON public.shifts;

CREATE POLICY "Personnel can view own shifts" ON public.shifts
  FOR SELECT USING (
    personnel_id = (SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Personnel can update own shifts" ON public.shifts
  FOR UPDATE USING (
    personnel_id = (SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1)
  );

-- Enable realtime for shifts so guards see new jobs instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
  END IF;
END $$;

COMMENT ON POLICY "Anyone can view available shifts" ON public.shifts IS 'Job board: all guards can see open shifts';
COMMENT ON POLICY "Personnel can claim open shifts" ON public.shifts IS 'Job board: guards can claim unassigned shifts';
