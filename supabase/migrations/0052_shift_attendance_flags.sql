create table if not exists public.shift_attendance_flags (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  confidence integer not null,
  suspicious boolean not null default false,
  flag_codes text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_note text
);

create unique index if not exists idx_shift_attendance_flags_shift_unique
  on public.shift_attendance_flags(shift_id);

create index if not exists idx_shift_attendance_flags_booking
  on public.shift_attendance_flags(booking_id);

create index if not exists idx_shift_attendance_flags_suspicious
  on public.shift_attendance_flags(suspicious);

alter table public.shift_attendance_flags enable row level security;

drop policy if exists "Service role full access shift attendance flags" on public.shift_attendance_flags;
create policy "Service role full access shift attendance flags"
  on public.shift_attendance_flags for all
  to service_role
  using (true)
  with check (true);

