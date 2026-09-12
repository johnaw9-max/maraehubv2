select 'marae_settings_lat_lng_columns_exist' as check_name,
  (select count(*) from information_schema.columns
   where table_name = 'marae_settings'
     and column_name in ('latitude', 'longitude')) = 2 as result

union all
select 'emergency_map_points_table_exists',
  exists(
    select 1 from information_schema.tables
    where table_name = 'emergency_map_points'
  )

union all
select 'emergency_map_points_columns_correct',
  (select count(*) from information_schema.columns
   where table_name = 'emergency_map_points'
     and column_name in ('id', 'entity_id', 'point_type', 'label', 'latitude', 'longitude', 'notes', 'created_at')) = 8

union all
select 'emergency_map_points_rls_enabled',
  exists(
    select 1 from pg_tables
    where tablename = 'emergency_map_points' and rowsecurity = true
  )

union all
select 'emergency_map_points_trustee_policy_exists',
  exists(
    select 1 from pg_policies
    where tablename = 'emergency_map_points'
      and cmd = 'ALL'
      and 'authenticated' = any(roles)
  );
