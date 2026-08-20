-- Corrects a real mistake in 20260820000000_create_check_column_generated.sql's
-- own comment, which claimed "left at the default PUBLIC execute, same as
-- check_cron_job_last_success()" - that precedent was wrong. Live grants
-- confirmed check_cron_job_last_success() was actually locked to
-- postgres/service_role on 12 Aug 2026 ("leaked cron run timing to anon, no
-- legitimate reason found for it to stay open" - see
-- ALLOWED_SECURITY_DEFINER_GRANTS in check-deadlines/index.ts). The same
-- reasoning applies here: check_column_generated() is a purely internal
-- tool for check-deadlines' own dead-field check, with no legitimate reason
-- for anon/authenticated to call it directly. Caught by the security/
-- access-control check itself (Stage 3, 86d3u7790) flagging it as
-- security_definer_not_allowlisted the same night it shipped.

-- Empirically, `revoke ... from public` alone was not enough here (unlike
-- find_orphaned_auth_users on 5 Aug) - anon/authenticated held explicit
-- grants that survived it, confirmed via information_schema.routine_privileges
-- after applying the public-only revoke. Revoking each role explicitly.
revoke execute on function public.check_column_generated(text, text) from public;
revoke execute on function public.check_column_generated(text, text) from anon;
revoke execute on function public.check_column_generated(text, text) from authenticated;
grant execute on function public.check_column_generated(text, text) to service_role;
