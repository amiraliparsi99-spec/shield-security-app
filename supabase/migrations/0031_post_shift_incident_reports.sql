-- Post-Shift Incident Report System
-- Allows venues to request incident reports from guards after shifts

-- Add incident report request fields to shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS incident_report_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS incident_report_requested_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS incident_report_requested_by UUID REFERENCES auth.users(id);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS incident_report_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS incident_report_submitted_at TIMESTAMPTZ;

-- Create post_shift_summaries table for detailed shift-end reports
CREATE TABLE IF NOT EXISTS post_shift_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  
  -- Summary content
  voice_transcript TEXT,
  summary_text TEXT,
  
  -- Quick stats
  total_incidents INTEGER DEFAULT 0,
  ejections_count INTEGER DEFAULT 0,
  medical_count INTEGER DEFAULT 0,
  disturbances_count INTEGER DEFAULT 0,
  
  -- Overall shift notes
  shift_notes TEXT,
  notable_events TEXT[],
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shift_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_post_shift_summaries_shift_id ON post_shift_summaries(shift_id);
CREATE INDEX IF NOT EXISTS idx_post_shift_summaries_personnel_id ON post_shift_summaries(personnel_id);
CREATE INDEX IF NOT EXISTS idx_post_shift_summaries_venue_id ON post_shift_summaries(venue_id);
CREATE INDEX IF NOT EXISTS idx_post_shift_summaries_status ON post_shift_summaries(status);
CREATE INDEX IF NOT EXISTS idx_shifts_incident_report_requested ON shifts(incident_report_requested) WHERE incident_report_requested = TRUE;

-- Enable RLS
ALTER TABLE post_shift_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Personnel can view their own summaries" ON post_shift_summaries;
CREATE POLICY "Personnel can view their own summaries"
  ON post_shift_summaries FOR SELECT
  USING (
    personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Personnel can create their own summaries" ON post_shift_summaries;
CREATE POLICY "Personnel can create their own summaries"
  ON post_shift_summaries FOR INSERT
  WITH CHECK (
    personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Personnel can update their own summaries" ON post_shift_summaries;
CREATE POLICY "Personnel can update their own summaries"
  ON post_shift_summaries FOR UPDATE
  USING (
    personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Venues can view summaries for their venue" ON post_shift_summaries;
CREATE POLICY "Venues can view summaries for their venue"
  ON post_shift_summaries FOR SELECT
  USING (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Venues can acknowledge summaries" ON post_shift_summaries;
CREATE POLICY "Venues can acknowledge summaries"
  ON post_shift_summaries FOR UPDATE
  USING (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
  )
  WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
  );

-- Function to request incident report from guard
CREATE OR REPLACE FUNCTION request_incident_report(p_shift_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_venue_user_id UUID;
BEGIN
  -- Verify caller owns the venue for this shift
  SELECT v.user_id INTO v_venue_user_id
  FROM shifts s
  JOIN venues v ON s.venue_id = v.id
  WHERE s.id = p_shift_id;
  
  IF v_venue_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to request incident report for this shift';
  END IF;
  
  -- Update shift
  UPDATE shifts
  SET 
    incident_report_requested = TRUE,
    incident_report_requested_at = NOW(),
    incident_report_requested_by = auth.uid()
  WHERE id = p_shift_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for post_shift_summaries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'post_shift_summaries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_shift_summaries;
  END IF;
END $$;
