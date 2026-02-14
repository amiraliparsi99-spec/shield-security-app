-- Core Features Migration: Shift Tracking, Documents, Marketplace, Reviews
-- =====================================================================

-- Drop existing tables if they exist (to handle partial migrations)
DROP TABLE IF EXISTS review_votes CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS shift_applications CASCADE;
DROP TABLE IF EXISTS shift_posts CASCADE;
DROP TABLE IF EXISTS user_documents CASCADE;
DROP TABLE IF EXISTS shift_locations CASCADE;
DROP TABLE IF EXISTS shift_checkins CASCADE;
DROP VIEW IF EXISTS user_ratings CASCADE;

-- 1. SHIFT TRACKING - GPS check-in/out and live location
-- =====================================================================

-- Shift check-ins table
CREATE TABLE shift_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,  -- Optional reference, may link to bookings if exists
  personnel_id UUID NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_in_lat DECIMAL(10, 8),
  check_in_lng DECIMAL(11, 8),
  check_in_address TEXT,
  check_out_time TIMESTAMPTZ,
  check_out_lat DECIMAL(10, 8),
  check_out_lng DECIMAL(11, 8),
  check_out_address TEXT,
  total_hours DECIMAL(5, 2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'checked_in', 'checked_out', 'verified', 'disputed')),
  notes TEXT,
  shift_date DATE DEFAULT CURRENT_DATE,
  shift_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live location tracking during shifts
CREATE TABLE shift_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL,
  personnel_id UUID NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient location queries
CREATE INDEX IF NOT EXISTS idx_shift_locations_checkin ON shift_locations(checkin_id);
CREATE INDEX IF NOT EXISTS idx_shift_locations_time ON shift_locations(recorded_at);
CREATE INDEX IF NOT EXISTS idx_shift_checkins_booking ON shift_checkins(booking_id);
CREATE INDEX IF NOT EXISTS idx_shift_checkins_personnel ON shift_checkins(personnel_id);

-- 2. DOCUMENT MANAGEMENT - Upload and store documents
-- Using user_documents to avoid conflict with existing documents table
-- =====================================================================

CREATE TABLE user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'sia_license', 'sia_cctv', 'sia_door', 'sia_cp',
    'dbs_check', 'first_aid', 'fire_safety',
    'passport', 'driving_license', 'right_to_work',
    'insurance', 'training_cert', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  reference_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_type ON user_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_user_documents_expiry ON user_documents(expiry_date);

-- 3. SHIFT MARKETPLACE - Available shifts for personnel to apply
-- =====================================================================

CREATE TABLE shift_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID,
  agency_id UUID,
  posted_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  shift_type TEXT NOT NULL CHECK (shift_type IN (
    'door_supervisor', 'cctv_operator', 'close_protection',
    'event_security', 'retail_security', 'corporate_security',
    'mobile_patrol', 'static_guard', 'concierge', 'other'
  )),
  location_name TEXT NOT NULL,
  location_address TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hourly_rate DECIMAL(8, 2) NOT NULL,
  positions_available INTEGER DEFAULT 1,
  positions_filled INTEGER DEFAULT 0,
  requirements TEXT[],
  sia_required BOOLEAN DEFAULT TRUE,
  dress_code TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('draft', 'open', 'filled', 'cancelled', 'completed')),
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'emergency')),
  application_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift applications
CREATE TABLE shift_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL,
  personnel_id UUID NOT NULL,
  cover_letter TEXT,
  proposed_rate DECIMAL(8, 2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'cancelled')),
  response_message TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, personnel_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_posts_date ON shift_posts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_posts_status ON shift_posts(status);
CREATE INDEX IF NOT EXISTS idx_shift_posts_type ON shift_posts(shift_type);
CREATE INDEX IF NOT EXISTS idx_shift_posts_venue ON shift_posts(venue_id);
CREATE INDEX IF NOT EXISTS idx_shift_posts_agency ON shift_posts(agency_id);
CREATE INDEX IF NOT EXISTS idx_shift_applications_shift ON shift_applications(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_applications_personnel ON shift_applications(personnel_id);

-- 4. REVIEWS & RATINGS
-- =====================================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  reviewer_id UUID NOT NULL,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('personnel', 'venue', 'agency')),
  reviewee_id UUID NOT NULL,
  reviewee_type TEXT NOT NULL CHECK (reviewee_type IN ('personnel', 'venue', 'agency')),
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  safety_rating INTEGER CHECK (safety_rating >= 1 AND safety_rating <= 5),
  title TEXT,
  content TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  response TEXT,
  response_at TIMESTAMPTZ,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review helpful votes
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(overall_rating);

-- Aggregate ratings view
CREATE OR REPLACE VIEW user_ratings AS
SELECT 
  reviewee_id,
  reviewee_type,
  COUNT(*) as total_reviews,
  ROUND(AVG(overall_rating)::numeric, 1) as avg_rating,
  ROUND(AVG(professionalism_rating)::numeric, 1) as avg_professionalism,
  ROUND(AVG(punctuality_rating)::numeric, 1) as avg_punctuality,
  ROUND(AVG(communication_rating)::numeric, 1) as avg_communication,
  ROUND(AVG(safety_rating)::numeric, 1) as avg_safety
FROM reviews
WHERE is_public = TRUE
GROUP BY reviewee_id, reviewee_type;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE shift_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- Shift Checkins policies (simplified - authenticated users can access)
CREATE POLICY "shift_checkins_select" ON shift_checkins
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shift_checkins_insert" ON shift_checkins
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "shift_checkins_update" ON shift_checkins
  FOR UPDATE TO authenticated USING (true);

-- Shift Locations policies
CREATE POLICY "shift_locations_select" ON shift_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shift_locations_insert" ON shift_locations
  FOR INSERT TO authenticated WITH CHECK (true);

-- User Documents policies
CREATE POLICY "user_documents_select" ON user_documents
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_public = TRUE);

CREATE POLICY "user_documents_insert" ON user_documents
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_documents_update" ON user_documents
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user_documents_delete" ON user_documents
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Shift Posts policies
CREATE POLICY "shift_posts_select" ON shift_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shift_posts_insert" ON shift_posts
  FOR INSERT TO authenticated WITH CHECK (posted_by = auth.uid());

CREATE POLICY "shift_posts_update" ON shift_posts
  FOR UPDATE TO authenticated USING (posted_by = auth.uid());

CREATE POLICY "shift_posts_delete" ON shift_posts
  FOR DELETE TO authenticated USING (posted_by = auth.uid());

-- Shift Applications policies
CREATE POLICY "shift_applications_select" ON shift_applications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shift_applications_insert" ON shift_applications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "shift_applications_update" ON shift_applications
  FOR UPDATE TO authenticated USING (true);

-- Reviews policies
CREATE POLICY "reviews_select" ON reviews
  FOR SELECT USING (is_public = TRUE OR reviewer_id = auth.uid() OR reviewee_id = auth.uid());

CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "reviews_update" ON reviews
  FOR UPDATE TO authenticated USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());

-- Review votes policies
CREATE POLICY "review_votes_select" ON review_votes
  FOR SELECT USING (true);

CREATE POLICY "review_votes_insert" ON review_votes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "review_votes_update" ON review_votes
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

-- Function to calculate total hours worked
CREATE OR REPLACE FUNCTION calculate_shift_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_out_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calc_shift_hours_trigger
  BEFORE INSERT OR UPDATE ON shift_checkins
  FOR EACH ROW EXECUTE FUNCTION calculate_shift_hours();

-- Function to update positions filled
CREATE OR REPLACE FUNCTION update_positions_filled()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'accepted' AND NEW.status = 'accepted') THEN
    UPDATE shift_posts 
    SET positions_filled = positions_filled + 1,
        status = CASE WHEN positions_filled + 1 >= positions_available THEN 'filled' ELSE status END
    WHERE id = NEW.shift_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'accepted' AND NEW.status != 'accepted' THEN
    UPDATE shift_posts 
    SET positions_filled = GREATEST(0, positions_filled - 1),
        status = CASE WHEN status = 'filled' THEN 'open' ELSE status END
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_positions_trigger
  AFTER INSERT OR UPDATE ON shift_applications
  FOR EACH ROW EXECUTE FUNCTION update_positions_filled();

-- Function to update helpful count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE reviews 
  SET helpful_count = (
    SELECT COUNT(*) FROM review_votes 
    WHERE review_id = COALESCE(NEW.review_id, OLD.review_id) AND is_helpful = TRUE
  )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_helpful_trigger
  AFTER INSERT OR UPDATE OR DELETE ON review_votes
  FOR EACH ROW EXECUTE FUNCTION update_review_helpful_count();

-- Add updated_at triggers (using DROP IF EXISTS to avoid conflicts)
DROP TRIGGER IF EXISTS update_shift_checkins_updated_at ON shift_checkins;
CREATE TRIGGER update_shift_checkins_updated_at BEFORE UPDATE ON shift_checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_shift_posts_updated_at ON shift_posts;
CREATE TRIGGER update_shift_posts_updated_at BEFORE UPDATE ON shift_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_shift_applications_updated_at ON shift_applications;
CREATE TRIGGER update_shift_applications_updated_at BEFORE UPDATE ON shift_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
