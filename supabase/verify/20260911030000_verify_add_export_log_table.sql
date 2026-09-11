select 'export_log_table_exists' as check_name,
  exists(
    select 1 from information_schema.tables
    where table_name = 'export_log'
  ) as result

union all
select 'export_log_columns_correct',
  (select count(*) from information_schema.columns
   where table_name = 'export_log'
     and column_name in ('id', 'account_email', 'export_type', 'row_count', 'exported_at')) = 5

union all
select 'export_log_rls_enabled',
  exists(
    select 1 from pg_tables
    where tablename = 'export_log' and rowsecurity = true
  )

union all
select 'export_log_insert_policy_exists',
  exists(
    select 1 from pg_policies
    where tablename = 'export_log'
      and cmd = 'INSERT'
      and 'authenticated' = any(roles)
  )

union all
select 'export_log_no_select_policy_for_authenticated',
  not exists(
    select 1 from pg_policies
    where tablename = 'export_log'
      and cmd in ('SELECT', 'ALL')
      and 'authenticated' = any(roles)
  )

union all
select 'export_log_no_anon_insert',
  not exists(
    select 1 from pg_policies
    where tablename = 'export_log'
      and cmd = 'INSERT'
      and 'anon' = any(roles)
  );
