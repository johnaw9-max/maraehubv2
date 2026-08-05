-- ClickUp 86d3u7790: catches the bug class behind Tineka's original login
-- dead-end (an auth.users row with no matching profiles row surfaces
-- in-app as a permanent "Could not load your profile" failure). auth
-- schema isn't reachable from check-deadlines via PostgREST (only public
-- and graphql_public are exposed - same wall Stage 2c hit with cron, see
-- 20260803000000_create_check_cron_job_last_success.sql), so this goes
-- through a SECURITY DEFINER wrapper, same pattern as that migration.
--
-- Unlike check_cron_job_last_success() (which only returns a timestamp),
-- this returns real email addresses - genuine PII - so EXECUTE is
-- explicitly locked to service_role rather than left at the PUBLIC
-- default every new function gets.

create or replace function public.find_orphaned_auth_users()
returns table(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email, u.created_at, u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null;
$$;

revoke execute on function public.find_orphaned_auth_users() from public;
grant execute on function public.find_orphaned_auth_users() to service_role;
