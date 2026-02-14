-- Shield App Row Level Security (RLS) Policies
-- Run this AFTER 001_initial_schema.sql

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferred_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- Get venue_id for current user
CREATE OR REPLACE FUNCTION get_user_venue_id()
RETURNS UUID AS $$
  SELECT id FROM venues WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Get personnel_id for current user
CREATE OR REPLACE FUNCTION get_user_personnel_id()
RETURNS UUID AS $$
  SELECT id FROM personnel WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Get agency_id for current user
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
  SELECT id FROM agencies WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- =====================================================
-- VENUES POLICIES
-- =====================================================

-- Venues are publicly readable (for personnel to find work)
CREATE POLICY "Venues are publicly readable"
  ON venues FOR SELECT
  USING (is_active = true);

-- Venue owners can manage their venue
CREATE POLICY "Venue owners can manage their venue"
  ON venues FOR ALL
  USING (user_id = auth.uid());

-- Admins can manage all venues
CREATE POLICY "Admins can manage all venues"
  ON venues FOR ALL
  USING (is_admin());

-- =====================================================
-- PERSONNEL POLICIES
-- =====================================================

-- Available personnel are publicly readable (for venues to book)
CREATE POLICY "Available personnel are publicly readable"
  ON personnel FOR SELECT
  USING (is_active = true AND is_available = true);

-- Personnel can manage their own profile
CREATE POLICY "Personnel can manage own profile"
  ON personnel FOR ALL
  USING (user_id = auth.uid());

-- Agencies can view their staff
CREATE POLICY "Agencies can view their staff"
  ON personnel FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agency_staff 
      WHERE agency_staff.personnel_id = personnel.id 
      AND agency_staff.agency_id = get_user_agency_id()
    )
  );

-- Admins can manage all personnel
CREATE POLICY "Admins can manage all personnel"
  ON personnel FOR ALL
  USING (is_admin());

-- =====================================================
-- AGENCIES POLICIES
-- =====================================================

-- Active agencies are publicly readable
CREATE POLICY "Active agencies are publicly readable"
  ON agencies FOR SELECT
  USING (is_active = true);

-- Agency owners can manage their agency
CREATE POLICY "Agency owners can manage their agency"
  ON agencies FOR ALL
  USING (user_id = auth.uid());

-- Admins can manage all agencies
CREATE POLICY "Admins can manage all agencies"
  ON agencies FOR ALL
  USING (is_admin());

-- =====================================================
-- AGENCY STAFF POLICIES
-- =====================================================

-- Agencies can manage their staff relationships
CREATE POLICY "Agencies can manage their staff"
  ON agency_staff FOR ALL
  USING (agency_id = get_user_agency_id());

-- Personnel can view their agency memberships
CREATE POLICY "Personnel can view own agency memberships"
  ON agency_staff FOR SELECT
  USING (personnel_id = get_user_personnel_id());

-- =====================================================
-- AVAILABILITY POLICIES
-- =====================================================

-- Personnel can manage their own availability
CREATE POLICY "Personnel can manage own availability"
  ON availability FOR ALL
  USING (personnel_id = get_user_personnel_id());

-- Venues can view personnel availability
CREATE POLICY "Venues can view personnel availability"
  ON venues FOR SELECT
  USING (get_user_role() = 'venue');

-- =====================================================
-- BLOCKED DATES POLICIES
-- =====================================================

-- Personnel can manage their blocked dates
CREATE POLICY "Personnel can manage own blocked dates"
  ON blocked_dates FOR ALL
  USING (personnel_id = get_user_personnel_id());

-- =====================================================
-- SPECIAL AVAILABILITY POLICIES
-- =====================================================

-- Personnel can manage their special availability
CREATE POLICY "Personnel can manage own special availability"
  ON special_availability FOR ALL
  USING (personnel_id = get_user_personnel_id());

-- =====================================================
-- BOOKINGS POLICIES
-- =====================================================

-- Venues can manage their bookings
CREATE POLICY "Venues can manage their bookings"
  ON bookings FOR ALL
  USING (venue_id = get_user_venue_id());

-- Personnel can view bookings they're assigned to
CREATE POLICY "Personnel can view assigned bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shifts 
      WHERE shifts.booking_id = bookings.id 
      AND shifts.personnel_id = get_user_personnel_id()
    )
  );

-- Agencies can view bookings their staff are assigned to
CREATE POLICY "Agencies can view staff bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shifts 
      WHERE shifts.booking_id = bookings.id 
      AND shifts.agency_id = get_user_agency_id()
    )
  );

-- Admins can manage all bookings
CREATE POLICY "Admins can manage all bookings"
  ON bookings FOR ALL
  USING (is_admin());

-- =====================================================
-- SHIFTS POLICIES
-- =====================================================

-- Venues can view shifts for their bookings
CREATE POLICY "Venues can view their booking shifts"
  ON shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = shifts.booking_id 
      AND bookings.venue_id = get_user_venue_id()
    )
  );

-- Personnel can view and update their shifts
CREATE POLICY "Personnel can view own shifts"
  ON shifts FOR SELECT
  USING (personnel_id = get_user_personnel_id());

CREATE POLICY "Personnel can update own shifts"
  ON shifts FOR UPDATE
  USING (personnel_id = get_user_personnel_id());

-- Agencies can manage shifts for their staff
CREATE POLICY "Agencies can manage staff shifts"
  ON shifts FOR ALL
  USING (agency_id = get_user_agency_id());

-- Admins can manage all shifts
CREATE POLICY "Admins can manage all shifts"
  ON shifts FOR ALL
  USING (is_admin());

-- =====================================================
-- DOCUMENTS POLICIES
-- =====================================================

-- Personnel can manage their own documents
CREATE POLICY "Personnel can manage own documents"
  ON documents FOR ALL
  USING (personnel_id = get_user_personnel_id());

-- Venues can view verified documents of personnel assigned to their bookings
CREATE POLICY "Venues can view assigned personnel documents"
  ON documents FOR SELECT
  USING (
    status = 'verified' AND
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN bookings b ON s.booking_id = b.id
      WHERE s.personnel_id = documents.personnel_id
      AND b.venue_id = get_user_venue_id()
    )
  );

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
  ON documents FOR ALL
  USING (is_admin());

-- =====================================================
-- INCIDENTS POLICIES
-- =====================================================

-- Personnel can manage incidents they reported
CREATE POLICY "Personnel can manage own incidents"
  ON incidents FOR ALL
  USING (personnel_id = get_user_personnel_id());

-- Venues can view incidents at their venue
CREATE POLICY "Venues can view their incidents"
  ON incidents FOR SELECT
  USING (venue_id = get_user_venue_id());

-- Venues can acknowledge incidents
CREATE POLICY "Venues can acknowledge incidents"
  ON incidents FOR UPDATE
  USING (venue_id = get_user_venue_id());

-- Admins can manage all incidents
CREATE POLICY "Admins can manage all incidents"
  ON incidents FOR ALL
  USING (is_admin());

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================

-- Users can create reviews for shifts they participated in
CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

-- Public reviews are readable by all
CREATE POLICY "Public reviews are readable"
  ON reviews FOR SELECT
  USING (is_public = true);

-- Users can view reviews about themselves
CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  USING (reviewee_id = auth.uid());

-- =====================================================
-- PREFERRED/BLOCKED STAFF POLICIES
-- =====================================================

-- Venues can manage their preferred staff
CREATE POLICY "Venues can manage preferred staff"
  ON preferred_staff FOR ALL
  USING (venue_id = get_user_venue_id());

-- Venues can manage their blocked staff
CREATE POLICY "Venues can manage blocked staff"
  ON blocked_staff FOR ALL
  USING (venue_id = get_user_venue_id());

-- =====================================================
-- EVENT TEMPLATES POLICIES
-- =====================================================

-- Venues can manage their templates
CREATE POLICY "Venues can manage own templates"
  ON event_templates FOR ALL
  USING (venue_id = get_user_venue_id());

-- =====================================================
-- CONVERSATIONS POLICIES
-- =====================================================

-- Users can view their conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- =====================================================
-- MESSAGES POLICIES
-- =====================================================

-- Users can view messages in their conversations
CREATE POLICY "Users can view conversation messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
  );

-- Users can send messages to their conversations
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
  );

-- Users can mark messages as read
CREATE POLICY "Users can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
  );

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- System can create notifications (via service role)
-- Note: Notifications are typically created server-side with service role

-- =====================================================
-- END OF RLS POLICIES
-- =====================================================
