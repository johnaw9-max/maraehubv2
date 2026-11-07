-- Rollback for B2: restores the previous single policy (members have full control of their own rows).
drop policy if exists "bookings: trustees within entity"       on public.bookings;
drop policy if exists "bookings: member read own"              on public.bookings;
drop policy if exists "bookings: member insert own pending"    on public.bookings;
drop policy if exists "bookings: member update own"            on public.bookings;
drop policy if exists "bookings: member delete own pending"    on public.bookings;
drop policy if exists "Trustees within entity or own bookings" on public.bookings;
create policy "Trustees within entity or own bookings"
  on public.bookings for all to authenticated
  using (
    (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
      and public.is_entity_member(bookings.entity_id))
    or bookings.user_id = auth.uid()
  )
  with check (
    (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
      and public.is_entity_member(bookings.entity_id))
    or bookings.user_id = auth.uid()
  );
