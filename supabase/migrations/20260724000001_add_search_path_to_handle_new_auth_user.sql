-- Defensive hardening only - handle_new_auth_user() was not actually broken.
-- Adds SET search_path = public, matching the fix applied the same night to
-- update_last_sign_in() (see 20260724000000_fix_update_last_sign_in_search_path.sql),
-- which had the exact same missing-search_path gap but was actually broken
-- by it (every Tineka login failed with "Database error granting user").
--
-- handle_new_auth_user() already explicitly qualified public.profiles, so it
-- never had this bug - but any SECURITY DEFINER function is exposed to the
-- same class of risk without an explicit search_path, since it uses the
-- calling session's search_path rather than the definer's, unless
-- overridden. Applying the same standard pattern here rather than waiting
-- for this function to break the same way if an unqualified reference is
-- ever added to it later.
--
-- Original migration (20260617164708_backfill_ghost_profiles_and_trigger.sql)
-- left unmodified beyond a pointer comment, since it's already recorded as
-- applied on Opeke.
--
-- Applied and verified identical on both Tineka and Opeke.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, email, full_name, role, trustee_role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      initcap(replace(replace(split_part(new.email, '@', 1), '.', ' '), '_', ' '))
    ),
    'community',
    'standard'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
