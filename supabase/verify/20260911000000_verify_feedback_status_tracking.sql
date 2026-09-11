select 'feedback_status_column_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'feedback' and column_name = 'status'
  ) as result

union all
select 'feedback_resolved_at_column_exists',
  exists(
    select 1 from information_schema.columns
    where table_name = 'feedback' and column_name = 'resolved_at'
  )

union all
select 'feedback_existing_rows_default_open',
  not exists(
    select 1 from feedback where status is distinct from 'open'
  )

union all
select 'feedback_status_check_constraint_exists',
  exists(
    select 1 from pg_constraint where conname = 'feedback_status_check'
  );
