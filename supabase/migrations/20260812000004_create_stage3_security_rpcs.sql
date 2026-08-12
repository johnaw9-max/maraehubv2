-- ClickUp 86d3u7790, Stage 3: security/access-control checks.
--
-- information_schema isn't reachable via PostgREST (confirmed repeatedly
-- this session, HTTP 406) - same wall as cron/auth/schema introspection,
-- same fix: narrow SECURITY DEFINER RPCs, locked to service_role from
-- creation (not left at the PUBLIC default and fixed later - applying
-- tonight's own lesson from the start this time).

create or replace function public.get_anon_granted_policies()
returns table(table_name text, policy_name text, cmd text)
language sql
security definer
set search_path = public
as $$
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public' and 'anon' = any(roles);
$$;

revoke execute on function public.get_anon_granted_policies() from public, anon, authenticated;
grant execute on function public.get_anon_granted_policies() to service_role;

create or replace function public.get_security_definer_function_grants()
returns table(function_name text, grantees text[])
language sql
security definer
set search_path = public
as $$
  select p.proname::text, array_agg(distinct g.grantee::text order by g.grantee::text)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join information_schema.routine_privileges g
    on g.routine_name = p.proname and g.routine_schema = 'public'
  where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef = true
  group by p.proname;
$$;

revoke execute on function public.get_security_definer_function_grants() from public, anon, authenticated;
grant execute on function public.get_security_definer_function_grants() to service_role;
