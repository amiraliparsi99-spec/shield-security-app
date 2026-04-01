-- Enable RLS on post_shift_summaries if not already enabled
ALTER TABLE post_shift_summaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Venues can view their summaries" ON post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can create summaries" ON post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can view their summaries" ON post_shift_summaries;

-- Venues can view summaries for their venue
CREATE POLICY "Venues can view their summaries"
ON post_shift_summaries FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT id FROM venues WHERE user_id = auth.uid()
  )
);

-- Personnel can create summaries
CREATE POLICY "Personnel can create summaries"
ON post_shift_summaries FOR INSERT
TO authenticated
WITH CHECK (
  personnel_id IN (
    SELECT id FROM personnel WHERE user_id = auth.uid()
  )
);

-- Personnel can view their own summaries
CREATE POLICY "Personnel can view their summaries"
ON post_shift_summaries FOR SELECT
TO authenticated
USING (
  personnel_id IN (
    SELECT id FROM personnel WHERE user_id = auth.uid()
  )
);

-- Personnel can update their own summaries
CREATE POLICY "Personnel can update their summaries"
ON post_shift_summaries FOR UPDATE
TO authenticated
USING (
  personnel_id IN (
    SELECT id FROM personnel WHERE user_id = auth.uid()
  )
);

-- Also add RLS for incidents table
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues can view their incidents" ON incidents;
DROP POLICY IF EXISTS "Personnel can create incidents" ON incidents;
DROP POLICY IF EXISTS "Personnel can view their incidents" ON incidents;

-- Venues can view incidents for their venue
CREATE POLICY "Venues can view their incidents"
ON incidents FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT id FROM venues WHERE user_id = auth.uid()
  )
);

-- Personnel can create incidents
CREATE POLICY "Personnel can create incidents"
ON incidents FOR INSERT
TO authenticated
WITH CHECK (
  personnel_id IN (
    SELECT id FROM personnel WHERE user_id = auth.uid()
  )
);

-- Personnel can view their own incidents
CREATE POLICY "Personnel can view their incidents"
ON incidents FOR SELECT
TO authenticated
USING (
  personnel_id IN (
    SELECT id FROM personnel WHERE user_id = auth.uid()
  )
);
