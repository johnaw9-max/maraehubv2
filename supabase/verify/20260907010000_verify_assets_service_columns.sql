select 'assets_last_service_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'assets' and column_name = 'last_service'
  ) as result

union all
select 'assets_next_service_exists',
  exists(
    select 1 from information_schema.columns
    where table_name = 'assets' and column_name = 'next_service'
  );
