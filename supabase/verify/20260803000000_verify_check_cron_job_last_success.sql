-- Verify-file for migration 20260803000000_create_check_cron_job_last_success.sql
-- (ClickUp 86d3u7790, Stage 2c). Run via scripts/deploy-migration.sh as the
-- second (verify-file) argument.

select 'function_exists' as check_name,
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'check_cron_job_last_success'
  ) as result
union all
select 'is_security_definer',
  coalesce((
    select p.prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'check_cron_job_last_success'
  ), false)
union all
select 'search_path_set_to_public',
  coalesce((
    select p.proconfig @> array['search_path=public']
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'check_cron_job_last_success'
  ), false)
union all
select 'returns_real_data_for_lock_monthly_kpi_snapshot',
  (select public.check_cron_job_last_success('%lock-monthly-kpi-snapshot%') is not null);
