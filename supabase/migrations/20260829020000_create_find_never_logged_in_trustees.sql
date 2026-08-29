-- ClickUp 86d3u7790, Stage 5 item 2: flags real, invited trustees who have
-- genuinely never logged in even once -- not just gone quiet recently.
-- Directly grounded in this session's real data audit: on Opeke (real
-- production), the slowest real trustee still took up to ~10 days between
-- invite and first login, and every one of the 7 real trustees has now
-- logged in at least once (0 "never logged in" cases live today). On the
-- test project, 1 of 7 trustee-role rows has never logged in -- real data,
-- accepted as-is per this session's own scoping decision, not special-cased.
--
-- auth.users.last_sign_in_at is the correct, cross-project-consistent
-- source -- confirmed live that profiles.last_sign_in_at (a Tineka-only,
-- ad hoc column/trigger pair, see 20260724000000_fix_update_last_sign_in_
-- search_path.sql) does not exist on Opeke at all. This mirrors the same
-- join get_trustee_login_activity() already uses in production.
--
-- Deliberately a NEW, narrowly-scoped function rather than extending
-- get_trustee_login_activity() -- that function already had one real PII
-- exposure incident (20260812000002) and is live infrastructure for the
-- founder's own login-activity view; no reason to add new blast radius to
-- it for an unrelated purpose. Same wall as every other auth-schema check
-- in this family (find_orphaned_auth_users, check_cron_job_last_success):
-- auth isn't reachable from check-deadlines via PostgREST, so this goes
-- through a SECURITY DEFINER wrapper.
--
-- Excludes is_system_account (86d3u7790 Stage 5 item 1's synthetic
-- login-check account would otherwise always show as "never logged in"
-- from the moment it's provisioned until its own first daily run).
--
-- Returns created_at so check-deadlines can apply its own grace-period
-- threshold in TypeScript, same as every other stage's day-count logic
-- (e.g. cron_health's days_since) -- this function stays data-only, no
-- threshold baked into the SQL.
--
-- Returns real trustee full_name/email -- comparable sensitivity to
-- find_orphaned_auth_users -- so EXECUTE is explicitly locked to
-- service_role rather than left at the PUBLIC default.
--
-- Real, live gap found and fixed while shipping this migration, both
-- projects: this project has an ALTER DEFAULT PRIVILEGES rule (FOR ROLE
-- postgres IN SCHEMA public) that grants EXECUTE on every newly-created
-- function directly to anon and authenticated -- a separate grant from
-- the PUBLIC pseudo-role, so "revoke ... from public" alone (the exact
-- pattern find_orphaned_auth_users used successfully in August, before
-- this default-privileges rule existed) does NOT remove it. Confirmed
-- live: this function was genuinely anon/authenticated-executable on
-- both projects immediately after creation, caught within minutes by
-- this session's own security_access_control check flagging a real
-- security_definer_grant_mismatch finding -- the exact incident class
-- this whole check exists to catch, working as designed. Revoking from
-- anon/authenticated explicitly (not just public) is now required for
-- any new SECURITY DEFINER function on this project.

create or replace function public.find_never_logged_in_trustees()
returns table(id uuid, full_name text, email text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, u.email, u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'trustee'
    and p.is_system_account = false
    and u.last_sign_in_at is null;
$$;

revoke execute on function public.find_never_logged_in_trustees() from public, anon, authenticated;
grant execute on function public.find_never_logged_in_trustees() to service_role;
