-- Rollback for M2. Restores one broad rule. NOTE: on the test project the original
-- policy name is "marae_settings: authenticated full access"; on Terere/Ōpeke it
-- is "allow_authenticated". Set :old_name accordingly (behaviour is identical).
begin;
drop policy if exists "marae_settings: signed-in read"   on public.marae_settings;
drop policy if exists "marae_settings: trustee insert"   on public.marae_settings;
drop policy if exists "marae_settings: trustee update"   on public.marae_settings;
drop policy if exists "marae_settings: trustee delete"   on public.marae_settings;
drop policy if exists "allow_authenticated" on public.marae_settings;
create policy "allow_authenticated" on public.marae_settings
  for all to authenticated using (true) with check (true);
commit;
