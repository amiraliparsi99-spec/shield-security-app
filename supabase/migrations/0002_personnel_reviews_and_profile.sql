-- Personnel: location_name, experience_since_year
-- Reviews: personnel_reviews table

alter table public.personnel
  add column if not exists location_name text,
  add column if not exists experience_since_year int;

comment on column public.personnel.location_name is 'Display string e.g. "Central London, UK". Overrides city+region when set.';
comment on column public.personnel.experience_since_year is 'Year they started in security, e.g. 2018 for "In security since 2018".';

-- Reviews: venue (author) reviews personnel after a booking
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

create index idx_personnel_reviews_personnel on public.personnel_reviews (personnel_id);
create index idx_personnel_reviews_author on public.personnel_reviews (author_id);

alter table public.personnel_reviews enable row level security;

-- Anyone can read reviews for a personnel profile
create policy "Personnel reviews are viewable by all" on public.personnel_reviews
  for select using (true);

-- Only the author (venue owner) can insert/update/delete their own review
create policy "Authors can insert own review" on public.personnel_reviews
  for insert to authenticated with check (auth.uid() = author_id);

create policy "Authors can update own review" on public.personnel_reviews
  for update to authenticated using (auth.uid() = author_id);

create policy "Authors can delete own review" on public.personnel_reviews
  for delete to authenticated using (auth.uid() = author_id);
