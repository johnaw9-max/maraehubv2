-- M2 · P1-07a · marae_settings: everyone signed in may read; only trustees may change.
-- Replaces access rules only. No rows, columns or tables are changed or deleted.
--
-- Trustee test uses public.is_trustee(): SECURITY DEFINER, returns true only when
-- the row in profiles whose id = auth.uid() (the id inside the caller's signed
-- session, which cannot be forged) has role = 'trustee'. A user cannot raise
-- their own role: trigger protect_profiles_permission_fields refuses any change
-- to one's own role/trustee_role (verified live on test, 5 Nov 2026).
-- The policy name differs by project, so both known names are dropped.
begin;
drop policy if exists "allow_authenticated"                        on public.marae_settings;
drop policy if exists "marae_settings: authenticated full access"  on public.marae_settings;
drop policy if exists "marae_settings: signed-in read"   on public.marae_settings;  -- re-run safety
drop policy if exists "marae_settings: trustee insert"   on public.marae_settings;
drop policy if exists "marae_settings: trustee update"   on public.marae_settings;
drop policy if exists "marae_settings: trustee delete"   on public.marae_settings;
create policy "marae_settings: signed-in read" on public.marae_settings
  for select to authenticated using (true);
create policy "marae_settings: trustee insert" on public.marae_settings
  for insert to authenticated with check (public.is_trustee());
create policy "marae_settings: trustee update" on public.marae_settings
  for update to authenticated using (public.is_trustee()) with check (public.is_trustee());
create policy "marae_settings: trustee delete" on public.marae_settings
  for delete to authenticated using (public.is_trustee());
commit;
