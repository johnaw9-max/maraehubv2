select 'ai_usage_log_exists' as check_name,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'ai_usage_log') = 1 as result
union all
select 'ai_usage_log_row_level_security_on',
  coalesce((select relrowsecurity from pg_class where oid = 'public.ai_usage_log'::regclass), false)
union all
select 'ai_usage_log_has_no_policies',
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'ai_usage_log') = 0
union all
select 'marae_settings_has_ai_monthly_limit_integer',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'marae_settings' and column_name = 'ai_monthly_limit' and data_type = 'integer') = 1;
