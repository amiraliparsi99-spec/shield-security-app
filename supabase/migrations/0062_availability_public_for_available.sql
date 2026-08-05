-- 0062_availability_public_for_available.sql
-- Let venues/agencies see a guard's weekly availability in the Find Staff
-- directory. Previously only the guard could read their own availability rows,
-- so the scout profile showed nothing. This exposes availability for guards who
-- are already discoverable (active + available) — same scope as the directory.

DROP POLICY IF EXISTS "Availability public for available personnel" ON public.availability;

CREATE POLICY "Availability public for available personnel"
  ON public.availability FOR SELECT
  TO authenticated
  USING (
    personnel_id IN (
      SELECT id FROM public.personnel
      WHERE is_active = true AND is_available = true
    )
  );
