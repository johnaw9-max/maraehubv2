-- Rollback for 20261029000000_restrict_profiles_select.sql.
-- Restores the single pre-existing ALL/true policy exactly as it was
-- live on the test project (zfefukxaliuximizjkwa) on 2026-10-29, and
-- drops everything the forward migration added.

drop trigger if exists protect_profiles_permission_fields on public.profiles;
drop function if exists public.profiles_protect_permission_fields();

drop policy if exists "profiles: read own row" on public.profiles;
drop policy if exists "profiles: trustees read every profile in their marae" on public.profiles;
drop policy if exists "profiles: trustees can insert profiles" on public.profiles;
drop policy if exists "profiles: own row or trustee can update" on public.profiles;

drop function if exists public.is_trustee();

create policy "profiles: authenticated full access"
  on public.profiles for all
  to authenticated
  using (true)
  with check (true);
