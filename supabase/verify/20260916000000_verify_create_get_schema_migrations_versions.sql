select 'get_schema_migrations_versions_exists' as check_name,
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_schema_migrations_versions'
  ) as result

union all
select 'get_schema_migrations_versions_is_security_definer',
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_schema_migrations_versions' and p.prosecdef = true
  )

union all
select 'get_schema_migrations_versions_grants_correct',
  (select array_agg(grantee::text order by grantee::text)
   from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'get_schema_migrations_versions')
  = array['postgres', 'service_role']

union all
select 'get_schema_migrations_versions_callable',
  (select count(*) from public.get_schema_migrations_versions()) >= 0;
