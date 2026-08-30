select 'compliance_pct_is_nullable' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'module_kpi_snapshots' and column_name = 'compliance_pct'
      and is_nullable = 'YES'
  ) as result
union all
select 'risk_pct_is_nullable',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'module_kpi_snapshots' and column_name = 'risk_pct'
      and is_nullable = 'YES'
  ) as result
union all
select 'assets_pct_unchanged_not_null',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'module_kpi_snapshots' and column_name = 'assets_pct'
      and is_nullable = 'NO'
  ) as result
union all
select 'goals_pct_unchanged_not_null',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'module_kpi_snapshots' and column_name = 'goals_pct'
      and is_nullable = 'NO'
  ) as result;
