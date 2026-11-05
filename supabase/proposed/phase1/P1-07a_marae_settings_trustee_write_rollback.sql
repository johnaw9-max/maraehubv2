-- Rollback for P1-07a_marae_settings_trustee_write.sql (restores the broad policy).
begin;
drop policy if exists "marae_settings: signed-in read"   on public.marae_settings;
drop policy if exists "marae_settings: trustee insert"   on public.marae_settings;
drop policy if exists "marae_settings: trustee update"   on public.marae_settings;
drop policy if exists "marae_settings: trustee delete"   on public.marae_settings;
drop policy if exists "allow_authenticated" on public.marae_settings;
create policy "allow_authenticated" on public.marae_settings
  for all to authenticated using (true) with check (true);
commit;
