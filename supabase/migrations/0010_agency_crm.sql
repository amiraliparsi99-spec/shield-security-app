-- Agency CRM: Staff Management & Booking Assignments
-- This migration adds tables for agencies to manage their staff roster
-- and assign personnel to bookings.

-- ============================================
-- AGENCY STAFF TABLE (many-to-many relationship)
-- Personnel can work for multiple agencies
-- ============================================

create table public.agency_staff (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  role text not null default 'contractor' check (role in ('employee', 'contractor', 'manager')),
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive', 'suspended')),
  hourly_rate int, -- Agency-specific rate override (in pence/cents)
  notes text, -- Internal notes about staff member
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agency_id, personnel_id)
);

-- Indexes for agency_staff
create index idx_agency_staff_agency on public.agency_staff(agency_id);
create index idx_agency_staff_personnel on public.agency_staff(personnel_id);
create index idx_agency_staff_status on public.agency_staff(status);

-- ============================================
-- BOOKING ASSIGNMENTS TABLE
-- Which staff are assigned to which bookings
-- ============================================

create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  agency_staff_id uuid not null references public.agency_staff(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'confirmed', 'declined', 'completed', 'no_show')),
  check_in_at timestamptz, -- For GPS tracking / time attendance
  check_out_at timestamptz,
  check_in_lat double precision, -- GPS coordinates at check-in
  check_in_lng double precision,
  check_out_lat double precision, -- GPS coordinates at check-out
  check_out_lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(booking_id, agency_staff_id)
);

-- Indexes for booking_assignments
create index idx_booking_assignments_booking on public.booking_assignments(booking_id);
create index idx_booking_assignments_staff on public.booking_assignments(agency_staff_id);
create index idx_booking_assignments_status on public.booking_assignments(status);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

alter table public.agency_staff enable row level security;
alter table public.booking_assignments enable row level security;

-- Helper function to check if user owns the agency
create or replace function public.user_owns_agency(agency_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.agencies a
    join public.profiles p on p.id = a.owner_id
    where a.id = agency_uuid
    and p.user_id = auth.uid()
  );
$$ language sql security definer;

-- Helper function to check if user is the personnel
create or replace function public.user_is_personnel(personnel_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.personnel p
    join public.profiles pr on pr.id = p.user_id
    where p.id = personnel_uuid
    and pr.user_id = auth.uid()
  );
$$ language sql security definer;

-- ============================================
-- AGENCY_STAFF POLICIES
-- ============================================

-- Agency owners can view all their staff
create policy "Agency owners can view their staff"
  on public.agency_staff for select
  using (public.user_owns_agency(agency_id));

-- Agency owners can add staff
create policy "Agency owners can add staff"
  on public.agency_staff for insert
  with check (public.user_owns_agency(agency_id));

-- Agency owners can update their staff
create policy "Agency owners can update their staff"
  on public.agency_staff for update
  using (public.user_owns_agency(agency_id));

-- Agency owners can remove staff
create policy "Agency owners can remove staff"
  on public.agency_staff for delete
  using (public.user_owns_agency(agency_id));

-- Personnel can view their own agency memberships (read-only)
create policy "Personnel can view their own memberships"
  on public.agency_staff for select
  using (public.user_is_personnel(personnel_id));

-- Personnel can update their own status (accept/decline invitations)
create policy "Personnel can update their own membership status"
  on public.agency_staff for update
  using (public.user_is_personnel(personnel_id))
  with check (
    -- Can only update status field (accept/decline invitation)
    public.user_is_personnel(personnel_id)
  );

-- ============================================
-- BOOKING_ASSIGNMENTS POLICIES
-- ============================================

-- Agency owners can view assignments for their bookings
create policy "Agency owners can view their assignments"
  on public.booking_assignments for select
  using (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_owns_agency(s.agency_id)
    )
  );

-- Agency owners can create assignments
create policy "Agency owners can create assignments"
  on public.booking_assignments for insert
  with check (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_owns_agency(s.agency_id)
    )
  );

-- Agency owners can update assignments
create policy "Agency owners can update assignments"
  on public.booking_assignments for update
  using (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_owns_agency(s.agency_id)
    )
  );

-- Agency owners can delete assignments
create policy "Agency owners can delete assignments"
  on public.booking_assignments for delete
  using (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_owns_agency(s.agency_id)
    )
  );

-- Personnel can view their own assignments
create policy "Personnel can view their own assignments"
  on public.booking_assignments for select
  using (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_is_personnel(s.personnel_id)
    )
  );

-- Personnel can update their own assignment status (confirm/decline)
create policy "Personnel can update their own assignment status"
  on public.booking_assignments for update
  using (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_is_personnel(s.personnel_id)
    )
  );

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

create trigger update_agency_staff_updated_at
  before update on public.agency_staff
  for each row execute function public.update_updated_at();

create trigger update_booking_assignments_updated_at
  before update on public.booking_assignments
  for each row execute function public.update_updated_at();
