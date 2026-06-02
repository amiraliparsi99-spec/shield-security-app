-- Allow venue owners to read GPS logs for shifts on their bookings
drop policy if exists "Venues can read GPS logs for their shifts" on public.shift_gps_log;
create policy "Venues can read GPS logs for their shifts"
  on public.shift_gps_log for select
  to authenticated
  using (
    shift_id in (
      select s.id
      from public.shifts s
      join public.bookings b on b.id = s.booking_id
      join public.venues v on v.id = b.venue_id
      where v.owner_id = auth.uid()
         or v.user_id  = auth.uid()
    )
  );
