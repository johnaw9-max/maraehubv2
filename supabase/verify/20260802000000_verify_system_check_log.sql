-- Verify-file for migration 20260802000000_create_system_check_log.sql
-- (ClickUp 86d3u7790). Run via scripts/deploy-migration.sh as the
-- second (verify-file) argument.

select 'table_exists' as check_name,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='system_check_log') as result
union all
select 'id_column_correct',
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='system_check_log' and column_name='id' and data_type='uuid' and is_nullable='NO' and column_default='gen_random_uuid()')
union all
select 'check_name_column_correct',
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='system_check_log' and column_name='check_name' and data_type='text' and is_nullable='NO')
union all
select 'run_at_column_correct',
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='system_check_log' and column_name='run_at' and data_type='timestamp with time zone' and is_nullable='NO' and column_default='now()')
union all
select 'findings_count_column_correct',
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='system_check_log' and column_name='findings_count' and data_type='integer' and is_nullable='NO' and column_default='0')
union all
select 'details_column_correct',
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='system_check_log' and column_name='details' and data_type='jsonb' and is_nullable='NO' and column_default='''[]''::jsonb')
union all
select 'rls_enabled',
  coalesce((select relrowsecurity from pg_class where relname='system_check_log'), false)
union all
select 'policy_exists',
  exists(select 1 from pg_policy where polrelid='system_check_log'::regclass and polname='system_check_log: authenticated full access');
