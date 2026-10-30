-- is_trustee() grant fix. Approved by John Williams, 2026-10-30.
-- TEST PROJECT ONLY (zfefukxaliuximizjkwa) for now — written so the
-- same file applies unchanged to every marae later, per the one-
-- codebase rule, but not yet applied to Terere, Opeke, or Iwi Hub.
--
-- public.is_trustee() (introduced in 20261029000000, SECURITY
-- DEFINER) was created without an explicit REVOKE, so it kept
-- Postgres's default: EXECUTE granted to PUBLIC. Since both anon and
-- authenticated belong to PUBLIC, that means an unauthenticated
-- request could already call it directly via RPC. This is the exact
-- same mistake this codebase already found and fixed once before, on
-- a different function (20260812000002's "Stage 2d" lesson: a new
-- Postgres function's default PUBLIC grant is easy to miss, and is
-- sufficient on its own regardless of any direct anon/authenticated
-- grants). Confirmed live on test: PUBLIC, anon, authenticated, and
-- postgres all had an explicit EXECUTE row in
-- information_schema.routine_privileges before this fix.
--
-- Calling is_trustee() as anon cannot read anyone's data by itself —
-- it returns a boolean, and auth.uid() is null for anon, so it always
-- returns false for an anonymous caller. The fix is about closing an
-- unnecessary grant and matching this codebase's own established
-- pattern for SECURITY DEFINER functions (get_trustee_login_activity
-- revokes from public/anon/authenticated outright), not a confirmed
-- data exposure the way the profiles policy fix was.
--
-- authenticated keeps EXECUTE — it is not optional: this function is
-- evaluated as part of every profiles RLS policy that calls it, under
-- the querying (authenticated) role's own privileges, regardless of
-- the function's own SECURITY DEFINER body. Revoking it from
-- authenticated would break every trustee-roster read/write added in
-- 20261029000000.
begin;

revoke execute on function public.is_trustee() from public;
revoke execute on function public.is_trustee() from anon;
grant execute on function public.is_trustee() to authenticated;

-- Safety gate, same style as 20261029000000: verify the exact
-- intended end state and fail the whole migration, rolling back
-- everything above, if it is not met.
do $$
declare
  open_grants int;
  auth_grant int;
begin
  select count(*) into open_grants
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'is_trustee'
    and grantee in ('PUBLIC', 'anon');

  select count(*) into auth_grant
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'is_trustee'
    and grantee = 'authenticated';

  if open_grants > 0 then
    raise exception
      'is_trustee grant fix aborted: % grant(s) to PUBLIC/anon still remain. Nothing in this migration was kept.',
      open_grants;
  end if;

  if auth_grant = 0 then
    raise exception
      'is_trustee grant fix aborted: authenticated has no EXECUTE grant. Profiles RLS policies would break. Nothing in this migration was kept.';
  end if;
end;
$$;

commit;
