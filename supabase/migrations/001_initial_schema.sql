-- Shield App Database Schema
-- Version: 1.0.0
-- Run this in your Supabase SQL Editor

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('venue', 'personnel', 'agency', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE shift_status AS ENUM ('pending', 'accepted', 'declined', 'checked_in', 'checked_out', 'no_show', 'cancelled');
CREATE TYPE document_type AS ENUM ('sia_license', 'dbs_certificate', 'first_aid', 'training', 'insurance', 'id', 'other');
CREATE TYPE document_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
CREATE TYPE incident_type AS ENUM ('ejection', 'medical', 'theft', 'assault', 'disturbance', 'other');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE notification_type AS ENUM ('booking', 'shift', 'payment', 'message', 'verification', 'system');

-- =====================================================
-- PROFILES (extends auth.users)
-- =====================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- VENUES
-- =====================================================

CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT, -- nightclub, bar, event_venue, corporate, etc.
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT DEFAULT 'Birmingham',
  postcode TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  capacity INTEGER,
  logo_url TEXT,
  cover_image_url TEXT,
  operating_hours JSONB, -- { monday: { open: "18:00", close: "03:00" }, ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(user_id)
);

-- =====================================================
-- PERSONNEL (Security Staff)
-- =====================================================

CREATE TABLE personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  city TEXT DEFAULT 'Birmingham',
  postcode TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  hourly_rate DECIMAL(10, 2) DEFAULT 16.00,
  experience_years INTEGER DEFAULT 0,
  skills TEXT[], -- ['Door Security', 'VIP Security', etc.]
  
  -- Shield Score components
  shield_score INTEGER DEFAULT 50 CHECK (shield_score >= 0 AND shield_score <= 100),
  reliability_score INTEGER DEFAULT 50,
  review_score DECIMAL(3, 2) DEFAULT 0.00,
  total_shifts INTEGER DEFAULT 0,
  total_hours DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Verification
  sia_license_number TEXT,
  sia_expiry_date DATE,
  sia_verified BOOLEAN DEFAULT FALSE,
  dbs_verified BOOLEAN DEFAULT FALSE,
  right_to_work_verified BOOLEAN DEFAULT FALSE,
  
  -- Preferences
  max_travel_distance INTEGER DEFAULT 10, -- miles
  night_shifts_ok BOOLEAN DEFAULT TRUE,
  weekend_only BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  
  UNIQUE(user_id)
);

-- =====================================================
-- AGENCIES
-- =====================================================

CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT DEFAULT 'Birmingham',
  postcode TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  
  -- Stats
  total_staff INTEGER DEFAULT 0,
  total_clients INTEGER DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  
  -- Commission
  default_commission_rate DECIMAL(5, 2) DEFAULT 15.00, -- percentage
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  
  UNIQUE(user_id)
);

-- =====================================================
-- AGENCY STAFF (Personnel linked to agencies)
-- =====================================================

CREATE TABLE agency_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5, 2), -- override agency default if set
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(agency_id, personnel_id)
);

-- =====================================================
-- AVAILABILITY (Weekly Schedule)
-- =====================================================

CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  is_available BOOLEAN DEFAULT FALSE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(personnel_id, day_of_week)
);

-- =====================================================
-- BLOCKED DATES (Personnel unavailable dates)
-- =====================================================

CREATE TABLE blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(personnel_id, date)
);

-- =====================================================
-- SPECIAL AVAILABILITY (Override weekly schedule)
-- =====================================================

CREATE TABLE special_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(personnel_id, date)
);

-- =====================================================
-- BOOKINGS
-- =====================================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  
  -- Event details
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  brief_notes TEXT,
  
  -- Requirements (stored as JSON for flexibility)
  staff_requirements JSONB NOT NULL, -- [{ role: "Door Security", quantity: 2, rate: 18 }]
  
  -- Status
  status booking_status DEFAULT 'pending',
  
  -- Financials
  estimated_total DECIMAL(10, 2),
  final_total DECIMAL(10, 2),
  platform_fee DECIMAL(10, 2),
  
  -- Assignment
  auto_assign BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- =====================================================
-- SHIFTS (Individual personnel assignments)
-- =====================================================

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  personnel_id UUID REFERENCES personnel(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL, -- if assigned via agency
  
  -- Role
  role TEXT NOT NULL,
  hourly_rate DECIMAL(10, 2) NOT NULL,
  
  -- Timing
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  -- Location verification
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8),
  
  -- Status
  status shift_status DEFAULT 'pending',
  
  -- Financials
  hours_worked DECIMAL(5, 2),
  total_pay DECIMAL(10, 2),
  agency_commission DECIMAL(10, 2),
  platform_fee DECIMAL(10, 2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT
);

-- =====================================================
-- DOCUMENTS
-- =====================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  
  type document_type NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER, -- bytes
  
  -- Verification
  status document_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  
  -- Expiry
  expiry_date DATE,
  expiry_reminder_sent BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  reference_number TEXT, -- e.g., SIA license number
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INCIDENTS
-- =====================================================

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  
  type incident_type NOT NULL,
  severity incident_severity NOT NULL,
  description TEXT NOT NULL,
  actions_taken TEXT NOT NULL,
  
  -- Details
  occurred_at TIMESTAMPTZ NOT NULL,
  witness_count INTEGER DEFAULT 0,
  police_involved BOOLEAN DEFAULT FALSE,
  police_reference TEXT,
  
  -- Status
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REVIEWS
-- =====================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  
  -- Who is reviewing whom
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_type user_role NOT NULL, -- venue reviewing personnel, or personnel reviewing venue
  
  -- Ratings (1-5)
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  
  -- Comment
  comment TEXT,
  
  -- Visibility
  is_public BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shift_id, reviewer_id)
);

-- =====================================================
-- PREFERRED STAFF (Venue favorites)
-- =====================================================

CREATE TABLE preferred_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(venue_id, personnel_id)
);

-- =====================================================
-- BLOCKED STAFF (Venue blocks)
-- =====================================================

CREATE TABLE blocked_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(venue_id, personnel_id)
);

-- =====================================================
-- EVENT TEMPLATES (Venue saved templates)
-- =====================================================

CREATE TABLE event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  staff_requirements JSONB NOT NULL,
  brief_notes TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONVERSATIONS
-- =====================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(participant1_id, participant2_id)
);

-- =====================================================
-- MESSAGES
-- =====================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB, -- additional context like booking_id, shift_id
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Venues
CREATE INDEX idx_venues_user_id ON venues(user_id);
CREATE INDEX idx_venues_city ON venues(city);

-- Personnel
CREATE INDEX idx_personnel_user_id ON personnel(user_id);
CREATE INDEX idx_personnel_city ON personnel(city);
CREATE INDEX idx_personnel_shield_score ON personnel(shield_score DESC);
CREATE INDEX idx_personnel_is_available ON personnel(is_available);

-- Agencies
CREATE INDEX idx_agencies_user_id ON agencies(user_id);

-- Availability
CREATE INDEX idx_availability_personnel_id ON availability(personnel_id);

-- Bookings
CREATE INDEX idx_bookings_venue_id ON bookings(venue_id);
CREATE INDEX idx_bookings_event_date ON bookings(event_date);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Shifts
CREATE INDEX idx_shifts_booking_id ON shifts(booking_id);
CREATE INDEX idx_shifts_personnel_id ON shifts(personnel_id);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_scheduled_start ON shifts(scheduled_start);

-- Documents
CREATE INDEX idx_documents_personnel_id ON documents(personnel_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_expiry_date ON documents(expiry_date);

-- Reviews
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);

-- Messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate personnel shield score
CREATE OR REPLACE FUNCTION calculate_shield_score(p_personnel_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_reliability INTEGER;
  v_reviews DECIMAL;
  v_experience INTEGER;
  v_verification INTEGER;
  v_total INTEGER;
BEGIN
  -- Get reliability (based on completed shifts vs no-shows)
  SELECT COALESCE(
    CASE 
      WHEN total_shifts = 0 THEN 50
      ELSE LEAST(100, 50 + (total_shifts * 0.5))
    END, 50
  ) INTO v_reliability
  FROM personnel WHERE id = p_personnel_id;
  
  -- Get average review score (0-5 -> 0-100)
  SELECT COALESCE(AVG(overall_rating) * 20, 50) INTO v_reviews
  FROM reviews r
  JOIN shifts s ON r.shift_id = s.id
  WHERE s.personnel_id = p_personnel_id;
  
  -- Experience score
  SELECT COALESCE(LEAST(100, experience_years * 10 + 30), 30) INTO v_experience
  FROM personnel WHERE id = p_personnel_id;
  
  -- Verification score
  SELECT COALESCE(
    CASE
      WHEN sia_verified AND dbs_verified THEN 100
      WHEN sia_verified THEN 70
      ELSE 30
    END, 30
  ) INTO v_verification
  FROM personnel WHERE id = p_personnel_id;
  
  -- Weighted average: Reliability 30%, Reviews 35%, Experience 20%, Verification 15%
  v_total := (v_reliability * 0.30 + v_reviews * 0.35 + v_experience * 0.20 + v_verification * 0.15)::INTEGER;
  
  -- Update the personnel record
  UPDATE personnel SET shield_score = v_total WHERE id = p_personnel_id;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON personnel FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON availability FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- INITIAL DATA (Optional - for testing)
-- =====================================================

-- You can uncomment and run this to seed test data
/*
-- Test venue
INSERT INTO profiles (id, role, email, display_name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'venue', 'venue@test.com', 'Test Venue');

INSERT INTO venues (user_id, name, type, city, postcode)
VALUES ('00000000-0000-0000-0000-000000000001', 'The Grand Club', 'nightclub', 'Birmingham', 'B1 1AA');

-- Test personnel
INSERT INTO profiles (id, role, email, display_name)
VALUES ('00000000-0000-0000-0000-000000000002', 'personnel', 'security@test.com', 'Marcus Johnson');

INSERT INTO personnel (user_id, display_name, hourly_rate, experience_years, skills, sia_verified)
VALUES ('00000000-0000-0000-0000-000000000002', 'Marcus Johnson', 18.00, 5, ARRAY['Door Security', 'VIP Security'], true);
*/

-- =====================================================
-- END OF MIGRATION
-- =====================================================
