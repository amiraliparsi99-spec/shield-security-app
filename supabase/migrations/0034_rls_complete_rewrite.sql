-- ============================================================
-- Shield RLS Complete Rewrite (Phase 1)
-- All policies use SECURITY DEFINER helpers to avoid recursion.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS (SECURITY DEFINER - single table each, no RLS recursion)
-- ---------------------------------------------------------------------------

-- Single venue ID for current user (NULL if not a venue)
CREATE OR REPLACE FUNCTION public.get_my_venue_id()
RETURNS UUID AS $$
  SELECT id FROM public.venues WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Set of venue IDs (for IN clauses; same result, allows multiple if schema changes)
CREATE OR REPLACE FUNCTION public.get_my_venue_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM public.venues WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Single personnel ID for current user
CREATE OR REPLACE FUNCTION public.get_my_personnel_id()
RETURNS UUID AS $$
  SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Single agency ID for current user
CREATE OR REPLACE FUNCTION public.get_my_agency_id()
RETURNS UUID AS $$
  SELECT id FROM public.agencies WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Whether current user is admin (reads profiles only)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Booking IDs where current user is assigned as personnel (avoids bookings->shifts recursion in policy)
CREATE OR REPLACE FUNCTION public.get_my_assigned_booking_ids()
RETURNS SETOF UUID AS $$
  SELECT s.booking_id FROM public.shifts s
  INNER JOIN public.personnel p ON p.id = s.personnel_id AND p.user_id = auth.uid()
  WHERE s.booking_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Booking IDs where current user's agency has shifts
CREATE OR REPLACE FUNCTION public.get_my_agency_booking_ids()
RETURNS SETOF UUID AS $$
  SELECT s.booking_id FROM public.shifts s
  INNER JOIN public.agencies a ON a.id = s.agency_id AND a.user_id = auth.uid()
  WHERE s.booking_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Ensure is_group_chat_member exists (used by group chat policies)
CREATE OR REPLACE FUNCTION public.is_group_chat_member(p_chat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_chat_members
    WHERE group_chat_id = p_chat_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_my_venue_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_venue_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_personnel_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_assigned_booking_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_booking_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_chat_member(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. VENUES - Drop all, recreate
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues are publicly readable" ON public.venues;
DROP POLICY IF EXISTS "Venue owners can manage their venue" ON public.venues;
DROP POLICY IF EXISTS "Admins can manage all venues" ON public.venues;

CREATE POLICY "Venues select own or public" ON public.venues FOR SELECT
  USING (is_active = true OR user_id = auth.uid());

CREATE POLICY "Venues insert own" ON public.venues FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Venues update own" ON public.venues FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Venues delete own" ON public.venues FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage venues" ON public.venues FOR ALL
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. PERSONNEL - Drop all, recreate
-- ---------------------------------------------------------------------------
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Available personnel are publicly readable" ON public.personnel;
DROP POLICY IF EXISTS "Personnel can manage own profile" ON public.personnel;
DROP POLICY IF EXISTS "Agencies can view their staff" ON public.personnel;
DROP POLICY IF EXISTS "Admins can manage all personnel" ON public.personnel;

CREATE POLICY "Personnel select own or public" ON public.personnel FOR SELECT
  USING (user_id = auth.uid() OR (is_active = true AND is_available = true));

CREATE POLICY "Personnel insert own" ON public.personnel FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Personnel update own" ON public.personnel FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Personnel delete own" ON public.personnel FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Agencies view staff" ON public.personnel FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_staff
      WHERE agency_staff.personnel_id = personnel.id
      AND agency_staff.agency_id = public.get_my_agency_id()
    )
  );

CREATE POLICY "Admins manage personnel" ON public.personnel FOR ALL
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. BOOKINGS - Drop all, recreate (no direct subquery to shifts in USING)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Personnel can view assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agencies can view provider bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agencies can view staff bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can manage their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;

CREATE POLICY "Bookings select venue" ON public.bookings FOR SELECT
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Bookings select personnel" ON public.bookings FOR SELECT
  USING (id IN (SELECT public.get_my_assigned_booking_ids()));

CREATE POLICY "Bookings select agency" ON public.bookings FOR SELECT
  USING (id IN (SELECT public.get_my_agency_booking_ids()));

CREATE POLICY "Bookings insert venue" ON public.bookings FOR INSERT
  WITH CHECK (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Bookings update venue" ON public.bookings FOR UPDATE
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Bookings delete venue" ON public.bookings FOR DELETE
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Bookings admin" ON public.bookings FOR ALL
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. SHIFTS - Drop all, recreate (venue access via helper, no bookings join in policy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues can view their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can update their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can view booking shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can view their booking shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can manage booking shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can view their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can update their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can view own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can update own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can view available shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can claim open shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can view their booking shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can view own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can update own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Agencies can manage staff shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins can manage all shifts" ON public.shifts;

-- Venue: can see shifts for their bookings (via function that returns booking_ids for venue)
CREATE OR REPLACE FUNCTION public.get_my_venue_booking_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM public.bookings WHERE venue_id IN (SELECT public.get_my_venue_ids());
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
GRANT EXECUTE ON FUNCTION public.get_my_venue_booking_ids() TO authenticated;

CREATE POLICY "Shifts select venue" ON public.shifts FOR SELECT
  USING (booking_id IN (SELECT public.get_my_venue_booking_ids()));

CREATE POLICY "Shifts update venue" ON public.shifts FOR UPDATE
  USING (booking_id IN (SELECT public.get_my_venue_booking_ids()));

CREATE POLICY "Shifts select personnel" ON public.shifts FOR SELECT
  USING (personnel_id = public.get_my_personnel_id() OR personnel_id IS NULL);

CREATE POLICY "Shifts update personnel" ON public.shifts FOR UPDATE
  USING (personnel_id = public.get_my_personnel_id());

CREATE POLICY "Shifts claim open" ON public.shifts FOR UPDATE
  USING (personnel_id IS NULL)
  WITH CHECK (personnel_id = public.get_my_personnel_id());

CREATE POLICY "Shifts agency" ON public.shifts FOR ALL
  USING (agency_id = public.get_my_agency_id());

CREATE POLICY "Shifts admin" ON public.shifts FOR ALL
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. POST_SHIFT_SUMMARIES - Drop all, recreate
-- ---------------------------------------------------------------------------
ALTER TABLE public.post_shift_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues can view their summaries" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can create summaries" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can view their summaries" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can update their summaries" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can view their own summaries" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can create their own summaries" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Personnel can update their own summaries" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Venues can view summaries for their venue" ON public.post_shift_summaries;
DROP POLICY IF EXISTS "Venues can acknowledge summaries" ON public.post_shift_summaries;

CREATE POLICY "Post shift summaries select venue" ON public.post_shift_summaries FOR SELECT
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Post shift summaries select personnel" ON public.post_shift_summaries FOR SELECT
  USING (personnel_id = public.get_my_personnel_id());

CREATE POLICY "Post shift summaries insert personnel" ON public.post_shift_summaries FOR INSERT
  WITH CHECK (personnel_id = public.get_my_personnel_id());

CREATE POLICY "Post shift summaries update personnel" ON public.post_shift_summaries FOR UPDATE
  USING (personnel_id = public.get_my_personnel_id());

-- ---------------------------------------------------------------------------
-- 7. INCIDENTS - Drop all, recreate
-- ---------------------------------------------------------------------------
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues can view their incidents" ON public.incidents;
DROP POLICY IF EXISTS "Personnel can create incidents" ON public.incidents;
DROP POLICY IF EXISTS "Personnel can view their incidents" ON public.incidents;
DROP POLICY IF EXISTS "Personnel can manage own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Venues can acknowledge incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admins can manage all incidents" ON public.incidents;

CREATE POLICY "Incidents select venue" ON public.incidents FOR SELECT
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Incidents select personnel" ON public.incidents FOR SELECT
  USING (personnel_id = public.get_my_personnel_id());

CREATE POLICY "Incidents insert personnel" ON public.incidents FOR INSERT
  WITH CHECK (personnel_id = public.get_my_personnel_id());

CREATE POLICY "Incidents update venue" ON public.incidents FOR UPDATE
  USING (venue_id IN (SELECT public.get_my_venue_ids()));

CREATE POLICY "Incidents admin" ON public.incidents FOR ALL
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. GROUP_CHATS, GROUP_CHAT_MEMBERS, GROUP_CHAT_MESSAGES
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view group chats they are members of" ON public.group_chats;
DROP POLICY IF EXISTS "Venue owners can create group chats" ON public.group_chats;
DROP POLICY IF EXISTS "Chat owners can update group chats" ON public.group_chats;

CREATE POLICY "Group chats select member" ON public.group_chats FOR SELECT
  USING (public.is_group_chat_member(id));

CREATE POLICY "Group chats insert" ON public.group_chats FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group chats update member" ON public.group_chats FOR UPDATE
  USING (public.is_group_chat_member(id));

DROP POLICY IF EXISTS "Users can view members of their group chats" ON public.group_chat_members;
DROP POLICY IF EXISTS "Chat owners can add members" ON public.group_chat_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON public.group_chat_members;

CREATE POLICY "Group chat members select" ON public.group_chat_members FOR SELECT
  USING (public.is_group_chat_member(group_chat_id));

CREATE POLICY "Group chat members insert" ON public.group_chat_members FOR INSERT
  WITH CHECK (public.is_group_chat_member(group_chat_id) OR true);

CREATE POLICY "Group chat members update own" ON public.group_chat_members FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view messages in their group chats" ON public.group_chat_messages;
DROP POLICY IF EXISTS "Members can send messages to their group chats" ON public.group_chat_messages;

CREATE POLICY "Group chat messages select" ON public.group_chat_messages FOR SELECT
  USING (public.is_group_chat_member(group_chat_id));

CREATE POLICY "Group chat messages insert" ON public.group_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_group_chat_member(group_chat_id)
  );

-- Members can update messages (e.g. read_by, metadata for incident report completed)
CREATE POLICY "Group chat messages update" ON public.group_chat_messages FOR UPDATE
  USING (public.is_group_chat_member(group_chat_id));
