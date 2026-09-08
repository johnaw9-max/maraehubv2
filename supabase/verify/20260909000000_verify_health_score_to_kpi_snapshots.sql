select 'module_kpi_snapshots_health_score_column_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'module_kpi_snapshots' and column_name = 'health_score'
  ) as result

union all
select 'health_score_is_nullable',
  exists(
    select 1 from information_schema.columns
    where table_name = 'module_kpi_snapshots' and column_name = 'health_score'
      and is_nullable = 'YES'
  );
