-- B2 · What a community member may do with their own booking.
--
-- Before: one policy gave the person who made a booking FULL control of it
-- (select, insert, update, delete, every column), so a member could approve
-- their own booking, or delete an approved one, by calling the API directly.
--
-- After:
--   trustees  – unchanged (all actions, within their entities)
--   members   – read their own bookings;
--               create their own, always as 'pending';
--               update their own while pending or approved, and the result must be
--               'pending' (so an edited approved booking goes back for approval);
--               delete their own only while pending.
-- Apply B3 (field protection) straight after this one.
drop policy if exists "Trustees within entity or own bookings" on public.bookings;
drop policy if exists "bookings: trustees within entity"       on public.bookings;
drop policy if exists "bookings: member read own"              on public.bookings;
drop policy if exists "bookings: member insert own pending"    on public.bookings;
drop policy if exists "bookings: member update own"            on public.bookings;
drop policy if exists "bookings: member delete own pending"    on public.bookings;

create policy "bookings: trustees within entity"
  on public.bookings for all to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and public.is_entity_member(bookings.entity_id)
  )
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and public.is_entity_member(bookings.entity_id)
  );

create policy "bookings: member read own"
  on public.bookings for select to authenticated
  using (user_id = auth.uid());

create policy "bookings: member insert own pending"
  on public.bookings for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "bookings: member update own"
  on public.bookings for update to authenticated
  using (user_id = auth.uid() and status in ('pending', 'approved'))
  with check (user_id = auth.uid() and status = 'pending');

create policy "bookings: member delete own pending"
  on public.bookings for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');
