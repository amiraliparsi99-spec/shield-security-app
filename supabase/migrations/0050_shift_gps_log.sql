create table if not exists public.shift_gps_log (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy real,
  altitude real,
  heading real,
  speed real,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_shift_gps_log_shift on public.shift_gps_log(shift_id);
create index if not exists idx_shift_gps_log_personnel on public.shift_gps_log(personnel_id);
create index if not exists idx_shift_gps_log_recorded_at on public.shift_gps_log(recorded_at desc);

alter table public.shift_gps_log enable row level security;

drop policy if exists "Personnel can insert own GPS logs" on public.shift_gps_log;
create policy "Personnel can insert own GPS logs"
  on public.shift_gps_log for insert
  to authenticated
  with check (
    personnel_id in (
      select p.id from public.personnel p where p.user_id = auth.uid()
    )
  );

drop policy if exists "Personnel can read own GPS logs" on public.shift_gps_log;
create policy "Personnel can read own GPS logs"
  on public.shift_gps_log for select
  to authenticated
  using (
    personnel_id in (
      select p.id from public.personnel p where p.user_id = auth.uid()
    )
  );

drop policy if exists "Service role full access shift gps log" on public.shift_gps_log;
create policy "Service role full access shift gps log"
  on public.shift_gps_log for all
  to service_role
  using (true)
  with check (true);
