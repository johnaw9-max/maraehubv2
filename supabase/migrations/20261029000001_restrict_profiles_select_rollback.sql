-- Rollback for 20261029000000_restrict_profiles_select.sql.
-- Restores the same ALL/true/true-to-authenticated permissions the
-- pre-existing blanket policy had, and drops everything the forward
-- migration added. Always restores it under ONE consistent name,
-- "profiles: authenticated full access" — the forward migration found
-- this same policy lived under two different names across projects
-- (that name on test, "allow_authenticated" on Terere and Opeke).
-- The restored permissions are identical either way; only the policy's
-- own internal name differs from a given project's original, which no
-- application code reads or depends on.

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
