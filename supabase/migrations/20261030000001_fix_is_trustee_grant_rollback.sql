-- Rollback for 20261030000000_fix_is_trustee_grant.sql.
-- Restores the default Postgres grant state (EXECUTE to PUBLIC,
-- which anon and authenticated both inherit), matching how
-- is_trustee() was left by 20261029000000 before this fix.
begin;

grant execute on function public.is_trustee() to public;

commit;
