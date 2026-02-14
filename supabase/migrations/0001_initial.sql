-- Shield — initial schema
-- Run in Supabase SQL editor or via Supabase CLI

-- Profile (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null check (role in ('venue', 'personnel', 'agency')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Venues
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  venue_type text not null check (venue_type in ('club', 'bar', 'stadium', 'event_space', 'restaurant', 'corporate', 'retail', 'other')),
  address text,
  city text,
  region text,
  postcode text,
  country text not null default 'GB',
  lat double precision,
  lng double precision,
  description text,
  capacity int,
  compliance_tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Personnel (individuals)
create table public.personnel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null,
  bio text,
  certs text[] default '{}',
  experience_years int,
  rate_per_hour int,
  currency text not null default 'GBP',
  city text,
  region text,
  country text not null default 'GB',
  lat double precision,
  lng double precision,
  status text not null default 'looking' check (status in ('available', 'looking', 'booked', 'off')),
  insurance_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agencies
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  certs text[] default '{}',
  rate_per_hour int,
  currency text not null default 'GBP',
  city text,
  region text,
  country text not null default 'GB',
  lat double precision,
  lng double precision,
  status text not null default 'looking' check (status in ('available', 'looking', 'booked', 'off')),
  insurance_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Availability
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('personnel', 'agency')),
  owner_id uuid not null,
  start timestamptz not null,
  "end" timestamptz not null,
  recurring text check (recurring in ('none', 'weekly', 'monthly')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Requests (venue needs)
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null,
  start timestamptz not null,
  "end" timestamptz not null,
  guards_count int not null,
  certs_required text[] default '{}',
  rate_offered int,
  currency text not null default 'GBP',
  description text,
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests (id) on delete set null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  provider_type text not null check (provider_type in ('personnel', 'agency')),
  provider_id uuid not null,
  start timestamptz not null,
  "end" timestamptz not null,
  guards_count int not null,
  rate int not null,
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_venues_owner on public.venues (owner_id);
create index idx_venues_slug on public.venues (slug);
create index idx_venues_country_region on public.venues (country, region);

create index idx_personnel_user on public.personnel (user_id);
create index idx_personnel_status on public.personnel (status);
create index idx_personnel_country_region on public.personnel (country, region);

create index idx_agencies_owner on public.agencies (owner_id);
create index idx_agencies_slug on public.agencies (slug);
create index idx_agencies_status on public.agencies (status);

create index idx_availability_owner on public.availability (owner_type, owner_id);
create index idx_availability_start_end on public.availability (start, "end");

create index idx_requests_venue on public.requests (venue_id);
create index idx_requests_status on public.requests (status);
create index idx_requests_start on public.requests (start);

create index idx_bookings_venue on public.bookings (venue_id);
create index idx_bookings_provider on public.bookings (provider_type, provider_id);
create index idx_bookings_status on public.bookings (status);

-- RLS (basic: enable; policies can be tightened)
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.personnel enable row level security;
alter table public.agencies enable row level security;
alter table public.availability enable row level security;
alter table public.requests enable row level security;
alter table public.bookings enable row level security;

-- Example: profiles are readable by authenticated, writable by self
create policy "Profiles are viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- Trigger: create profile on signup (run via Supabase Auth hook or Edge Function in production)
-- For now, you can create profile manually in app on first login.
