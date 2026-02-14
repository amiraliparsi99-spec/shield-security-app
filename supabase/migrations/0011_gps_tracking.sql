-- GPS Tracking System for Agency Staff
-- Real-time location tracking during active shifts

-- ============================================
-- STAFF LOCATIONS TABLE
-- Real-time GPS coordinates during shifts
-- ============================================

create table public.staff_locations (
  id uuid primary key default gen_random_uuid(),
  agency_staff_id uuid not null references public.agency_staff(id) on delete cascade,
  booking_assignment_id uuid references public.booking_assignments(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  accuracy float, -- GPS accuracy in meters
  altitude double precision,
  heading float, -- Direction of travel in degrees
  speed float, -- Speed in m/s
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes for efficient querying
create index idx_staff_locations_staff on public.staff_locations(agency_staff_id);
create index idx_staff_locations_assignment on public.staff_locations(booking_assignment_id);
create index idx_staff_locations_time on public.staff_locations(recorded_at desc);
create index idx_staff_locations_staff_time on public.staff_locations(agency_staff_id, recorded_at desc);

-- Spatial index for geographic queries (if PostGIS is enabled)
-- create index idx_staff_locations_geo on public.staff_locations using gist (
--   ST_SetSRID(ST_MakePoint(lng, lat), 4326)
-- );

-- ============================================
-- GEOFENCES TABLE
-- Define check-in/check-out boundaries for venues
-- ============================================

create table public.geofences (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null default 'Main Entrance',
  lat double precision not null,
  lng double precision not null,
  radius int not null default 100, -- Radius in meters
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_geofences_venue on public.geofences(venue_id);

-- ============================================
-- LOCATION CONSENT TABLE
-- Track personnel consent for location tracking
-- ============================================

create table public.location_consent (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  consented boolean not null default false,
  consented_at timestamptz,
  revoked_at timestamptz,
  ip_address text, -- For audit trail
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(personnel_id, agency_id)
);

create index idx_location_consent_personnel on public.location_consent(personnel_id);
create index idx_location_consent_agency on public.location_consent(agency_id);

-- ============================================
-- GEOFENCE EVENTS TABLE
-- Log entry/exit events for audit trail
-- ============================================

create table public.geofence_events (
  id uuid primary key default gen_random_uuid(),
  booking_assignment_id uuid not null references public.booking_assignments(id) on delete cascade,
  geofence_id uuid not null references public.geofences(id) on delete cascade,
  event_type text not null check (event_type in ('enter', 'exit')),
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now(),
  auto_action_taken text, -- 'check_in', 'check_out', or null if manual
  created_at timestamptz not null default now()
);

create index idx_geofence_events_assignment on public.geofence_events(booking_assignment_id);
create index idx_geofence_events_geofence on public.geofence_events(geofence_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

alter table public.staff_locations enable row level security;
alter table public.geofences enable row level security;
alter table public.location_consent enable row level security;
alter table public.geofence_events enable row level security;

-- Staff Locations Policies
-- Agency owners can view locations of their staff
create policy "Agency owners can view their staff locations"
  on public.staff_locations for select
  using (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_owns_agency(s.agency_id)
    )
  );

-- Personnel can insert their own locations
create policy "Personnel can insert their own locations"
  on public.staff_locations for insert
  with check (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_is_personnel(s.personnel_id)
    )
  );

-- Personnel can view their own locations
create policy "Personnel can view their own locations"
  on public.staff_locations for select
  using (
    exists (
      select 1 from public.agency_staff s
      where s.id = agency_staff_id
      and public.user_is_personnel(s.personnel_id)
    )
  );

-- Geofences Policies
-- Anyone can view geofences (public info for navigation)
create policy "Anyone can view geofences"
  on public.geofences for select
  using (true);

-- Only venue owners can manage geofences
create policy "Venue owners can manage geofences"
  on public.geofences for all
  using (
    exists (
      select 1 from public.venues v
      join public.profiles p on p.id = v.owner_id
      where v.id = venue_id
      and p.user_id = auth.uid()
    )
  );

-- Location Consent Policies
-- Personnel can manage their own consent
create policy "Personnel can manage their own consent"
  on public.location_consent for all
  using (public.user_is_personnel(personnel_id));

-- Agency owners can view consent status
create policy "Agency owners can view consent status"
  on public.location_consent for select
  using (public.user_owns_agency(agency_id));

-- Geofence Events Policies
-- Agency owners can view events for their assignments
create policy "Agency owners can view geofence events"
  on public.geofence_events for select
  using (
    exists (
      select 1 from public.booking_assignments ba
      join public.agency_staff s on s.id = ba.agency_staff_id
      where ba.id = booking_assignment_id
      and public.user_owns_agency(s.agency_id)
    )
  );

-- System can insert geofence events (via function)
create policy "System can insert geofence events"
  on public.geofence_events for insert
  with check (
    exists (
      select 1 from public.booking_assignments ba
      join public.agency_staff s on s.id = ba.agency_staff_id
      where ba.id = booking_assignment_id
      and public.user_is_personnel(s.personnel_id)
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate distance between two points (Haversine formula)
create or replace function public.calculate_distance_meters(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) returns double precision as $$
declare
  r double precision := 6371000; -- Earth's radius in meters
  dlat double precision;
  dlng double precision;
  a double precision;
  c double precision;
begin
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ^ 2;
  c := 2 * asin(sqrt(a));
  return r * c;
end;
$$ language plpgsql immutable;

-- Check if a point is inside a geofence
create or replace function public.is_inside_geofence(
  point_lat double precision,
  point_lng double precision,
  geofence_id uuid
) returns boolean as $$
declare
  fence record;
  distance double precision;
begin
  select lat, lng, radius into fence from public.geofences where id = geofence_id;
  if not found then return false; end if;
  
  distance := public.calculate_distance_meters(point_lat, point_lng, fence.lat, fence.lng);
  return distance <= fence.radius;
end;
$$ language plpgsql stable;

-- Get latest location for a staff member
create or replace function public.get_latest_staff_location(staff_id uuid)
returns table (
  lat double precision,
  lng double precision,
  accuracy float,
  recorded_at timestamptz
) as $$
begin
  return query
  select sl.lat, sl.lng, sl.accuracy, sl.recorded_at
  from public.staff_locations sl
  where sl.agency_staff_id = staff_id
  order by sl.recorded_at desc
  limit 1;
end;
$$ language plpgsql stable;

-- ============================================
-- TRIGGERS
-- ============================================

create trigger update_geofences_updated_at
  before update on public.geofences
  for each row execute function public.update_updated_at();

create trigger update_location_consent_updated_at
  before update on public.location_consent
  for each row execute function public.update_updated_at();

-- ============================================
-- DATA RETENTION (Optional cleanup function)
-- Keep location data for 90 days by default
-- ============================================

create or replace function public.cleanup_old_locations()
returns void as $$
begin
  delete from public.staff_locations
  where recorded_at < now() - interval '90 days';
end;
$$ language plpgsql;

-- Schedule this function to run daily via pg_cron if available
-- select cron.schedule('cleanup-locations', '0 3 * * *', 'select public.cleanup_old_locations()');
