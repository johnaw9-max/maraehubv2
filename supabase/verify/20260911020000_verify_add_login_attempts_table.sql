select 'login_attempts_table_exists' as check_name,
  exists(
    select 1 from information_schema.tables
    where table_name = 'login_attempts'
  ) as result

union all
select 'login_attempts_columns_correct',
  (select count(*) from information_schema.columns
   where table_name = 'login_attempts'
     and column_name in ('id', 'email', 'success', 'attempted_at')) = 4

union all
select 'login_attempts_rls_enabled',
  exists(
    select 1 from pg_tables
    where tablename = 'login_attempts' and rowsecurity = true
  )

union all
select 'login_attempts_insert_policy_exists',
  exists(
    select 1 from pg_policies
    where tablename = 'login_attempts'
      and cmd = 'INSERT'
      and 'anon' = any(roles)
  )

union all
select 'login_attempts_no_select_policy_for_anon',
  not exists(
    select 1 from pg_policies
    where tablename = 'login_attempts'
      and cmd in ('SELECT', 'ALL')
      and 'anon' = any(roles)
  );
