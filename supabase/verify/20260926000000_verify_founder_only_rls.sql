select 'is_founder_function_exists' as check_name,
  exists(
    select 1 from pg_proc where proname = 'is_founder'
  ) as result

union all
select 'founder_notes_policy_uses_is_founder',
  exists(
    select 1 from pg_policies
    where tablename = 'founder_notes' and qual ilike '%is_founder%'
  )

union all
select 'founder_notes_old_open_policy_gone',
  not exists(
    select 1 from pg_policies
    where tablename = 'founder_notes' and qual = 'true'
  )

union all
select 'feedback_insert_still_open',
  exists(
    select 1 from pg_policies
    where tablename = 'feedback' and cmd = 'INSERT' and with_check = 'true'
  )

union all
select 'feedback_select_founder_only',
  exists(
    select 1 from pg_policies
    where tablename = 'feedback' and cmd = 'SELECT' and qual ilike '%is_founder%'
  )

union all
select 'feedback_update_founder_only',
  exists(
    select 1 from pg_policies
    where tablename = 'feedback' and cmd = 'UPDATE' and qual ilike '%is_founder%'
  )

union all
select 'feedback_no_blanket_open_policy_remains',
  not exists(
    select 1 from pg_policies
    where tablename = 'feedback' and cmd = 'ALL' and qual = 'true'
  )

union all
select 'founder_metrics_table_exists',
  exists(
    select 1 from information_schema.tables where table_name = 'founder_metrics'
  )

union all
select 'founder_metrics_policy_founder_only',
  exists(
    select 1 from pg_policies
    where tablename = 'founder_metrics' and qual ilike '%is_founder%'
  )

union all
select 'marae_settings_founder_metrics_column_dropped',
  not exists(
    select 1 from information_schema.columns
    where table_name = 'marae_settings' and column_name = 'founder_metrics'
  );
