-- =====================================================
-- ERROR LOGGING SCHEMA
-- Track and monitor application errors
-- =====================================================

-- Error severity enum
CREATE TYPE error_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Error category enum
CREATE TYPE error_category AS ENUM (
  'auth',
  'database',
  'api',
  'payment',
  'booking',
  'notification',
  'file_upload',
  'validation',
  'unknown'
);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  severity error_severity NOT NULL DEFAULT 'medium',
  category error_category NOT NULL DEFAULT 'unknown',
  context JSONB DEFAULT '{}',
  environment TEXT DEFAULT 'production',
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_category ON error_logs(category);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_environment ON error_logs(environment);

-- Composite index for common queries
CREATE INDEX idx_error_logs_unresolved_critical 
  ON error_logs(severity, resolved) 
  WHERE resolved = false AND severity IN ('high', 'critical');

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view error logs
CREATE POLICY "Admins can view all error logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow insert from any authenticated or service role
CREATE POLICY "Service can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true);

-- Admins can update (mark resolved)
CREATE POLICY "Admins can update error logs"
  ON error_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get error stats for dashboard
CREATE OR REPLACE FUNCTION get_error_stats(
  p_hours INTEGER DEFAULT 24
) RETURNS TABLE (
  total_errors BIGINT,
  critical_errors BIGINT,
  high_errors BIGINT,
  unresolved_errors BIGINT,
  most_common_category error_category
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical,
      COUNT(*) FILTER (WHERE severity = 'high') as high,
      COUNT(*) FILTER (WHERE resolved = false) as unresolved,
      MODE() WITHIN GROUP (ORDER BY category) as common_category
    FROM error_logs
    WHERE created_at > NOW() - (p_hours || ' hours')::INTERVAL
  )
  SELECT 
    stats.total,
    stats.critical,
    stats.high,
    stats.unresolved,
    stats.common_category
  FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup old resolved errors (keep for 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_errors()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs
  WHERE resolved = true
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
