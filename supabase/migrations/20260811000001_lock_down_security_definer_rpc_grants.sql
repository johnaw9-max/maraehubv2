-- Urgent fix, found while verifying 20260811000000's grants: Supabase grants
-- EXECUTE on new public-schema functions directly to anon and authenticated
-- by default (default privileges, not inherited via the PUBLIC pseudo-role).
-- "revoke execute ... from public" - used by both this migration's function
-- and find_orphaned_auth_users() (20260805010000) - does not touch those
-- direct grants at all, despite that migration's comment claiming EXECUTE
-- was "explicitly locked to service_role."
--
-- Confirmed live and exploitable: find_orphaned_auth_users() - which
-- returns real trustee email addresses - was callable via
-- /rest/v1/rpc/find_orphaned_auth_users using only the public anon key,
-- no authentication at all, since it shipped 5 August 2026. Returned []
-- only because Opeke has 0 orphaned accounts right now; a real one would
-- have been exposed to any unauthenticated visitor.
--
-- Idempotent / safe to re-run.

revoke execute on function public.find_orphaned_auth_users() from anon, authenticated;
revoke execute on function public.get_public_schema_columns() from anon, authenticated;
