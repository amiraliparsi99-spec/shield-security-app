-- ============================================
-- COMPLETE DATABASE SETUP - Run All Migrations
-- ============================================
-- Run these migrations IN ORDER in Supabase SQL Editor
-- Copy and paste each section, one at a time

-- ============================================
-- MIGRATION 1: Initial Schema (0001_initial.sql)
-- ============================================
-- This creates the profiles table and all base tables

-- Profile (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null check (role in ('venue', 'personnel', 'agency')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Venues
create table if not exists public.venues (
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
create table if not exists public.personnel (
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
create table if not exists public.agencies (
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
create table if not exists public.availability (
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
create table if not exists public.requests (
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
create table if not exists public.bookings (
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
create index if not exists idx_venues_owner on public.venues (owner_id);
create index if not exists idx_venues_slug on public.venues (slug);
create index if not exists idx_personnel_user on public.personnel (user_id);
create index if not exists idx_personnel_status on public.personnel (status);
create index if not exists idx_agencies_owner on public.agencies (owner_id);
create index if not exists idx_agencies_slug on public.agencies (slug);
create index if not exists idx_agencies_status on public.agencies (status);
create index if not exists idx_availability_owner on public.availability (owner_type, owner_id);
create index if not exists idx_requests_venue on public.requests (venue_id);
create index if not exists idx_requests_status on public.requests (status);
create index if not exists idx_bookings_venue on public.bookings (venue_id);
create index if not exists idx_bookings_provider on public.bookings (provider_type, provider_id);
create index if not exists idx_bookings_status on public.bookings (status);

-- RLS (basic: enable; policies can be tightened)
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.personnel enable row level security;
alter table public.agencies enable row level security;
alter table public.availability enable row level security;
alter table public.requests enable row level security;
alter table public.bookings enable row level security;

-- Basic RLS policies
create policy if not exists "Profiles are viewable by authenticated" on public.profiles 
  for select to authenticated using (true);
create policy if not exists "Users can update own profile" on public.profiles 
  for update to authenticated using (auth.uid() = id);

-- ============================================
-- MIGRATION 2: Personnel Reviews (0002_personnel_reviews_and_profile.sql)
-- ============================================

alter table public.personnel
  add column if not exists location_name text,
  add column if not exists experience_since_year int;

create table if not exists public.personnel_reviews (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(author_id, booking_id)
);

create index if not exists idx_personnel_reviews_personnel on public.personnel_reviews (personnel_id);
create index if not exists idx_personnel_reviews_author on public.personnel_reviews (author_id);

alter table public.personnel_reviews enable row level security;

create policy if not exists "Personnel reviews are viewable by all" on public.personnel_reviews
  for select using (true);
create policy if not exists "Authors can insert own review" on public.personnel_reviews
  for insert to authenticated with check (auth.uid() = author_id);
create policy if not exists "Authors can update own review" on public.personnel_reviews
  for update to authenticated using (auth.uid() = author_id);
create policy if not exists "Authors can delete own review" on public.personnel_reviews
  for delete to authenticated using (auth.uid() = author_id);

-- ============================================
-- MIGRATION 3: Update Profiles Role Constraint (for admin support)
-- ============================================
-- Update profiles to allow 'admin' role

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check 
  check (role in ('venue', 'personnel', 'agency', 'admin'));

-- ============================================
-- MIGRATION 4: KYC Verification System (0006_kyc_verification.sql)
-- ============================================
-- This is a large migration - see the full file: supabase/migrations/0006_kyc_verification.sql
-- For now, we'll skip this and you can run it separately if needed

-- ============================================
-- MIGRATION 5: Admin Role Support (0007_admin_role.sql)
-- ============================================
-- See the full file: supabase/migrations/0007_admin_role.sql
-- Run this after the verification system if you need admin features

-- ============================================
-- VERIFY SETUP
-- ============================================
-- Run this to check if everything was created:

SELECT 
  'profiles' as table_name, count(*) as row_count FROM public.profiles
UNION ALL
SELECT 'venues', count(*) FROM public.venues
UNION ALL
SELECT 'personnel', count(*) FROM public.personnel
UNION ALL
SELECT 'agencies', count(*) FROM public.agencies;
