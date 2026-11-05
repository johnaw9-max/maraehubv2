-- Phase 1, item 7 finding (P1-07a): marae_settings write access.
-- PROPOSED — DO NOT APPLY until the live RLS check (P1-07) confirms the
-- current policy on each project and John approves.
--
-- Finding (repository schema.sql): policy "allow_authenticated" on
-- marae_settings is FOR ALL TO authenticated USING (true) WITH CHECK (true).
-- That lets ANY signed-in account — including community members who sign in
-- through the community portal — change marae settings through the API,
-- including payment_details (the bank details printed on booking invoices),
-- reminder settings and the AI drafting switch. The app never offers this to
-- community members; the gap is at the database.
--
-- Change: everyone signed in can still READ settings (community pages may show
-- the marae name); only trustees can insert/update/delete.
-- Trustee test is inline (own profile row is always readable).
begin;

drop policy if exists "allow_authenticated" on public.marae_settings;
-- Make re-running safe.
drop policy if exists "marae_settings: signed-in read"   on public.marae_settings;
drop policy if exists "marae_settings: trustee insert"   on public.marae_settings;
drop policy if exists "marae_settings: trustee update"   on public.marae_settings;
drop policy if exists "marae_settings: trustee delete"   on public.marae_settings;

create policy "marae_settings: signed-in read" on public.marae_settings
  for select to authenticated using (true);

create policy "marae_settings: trustee insert" on public.marae_settings
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'));

create policy "marae_settings: trustee update" on public.marae_settings
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'));

create policy "marae_settings: trustee delete" on public.marae_settings
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'));

commit;
