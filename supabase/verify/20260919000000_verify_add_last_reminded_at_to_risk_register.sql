select 'risk_register_last_reminded_at_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'risk_register' and column_name = 'last_reminded_at'
  ) as result

union all
select 'risk_register_last_reminded_at_type_correct',
  (select data_type from information_schema.columns
   where table_name = 'risk_register' and column_name = 'last_reminded_at') = 'timestamp with time zone';
