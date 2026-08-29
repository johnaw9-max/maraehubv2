select 'is_system_account_column_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_system_account'
  ) as result
union all
select 'is_system_account_is_boolean',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_system_account'
      and data_type = 'boolean'
  ) as result
union all
select 'is_system_account_not_nullable',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_system_account'
      and is_nullable = 'NO'
  ) as result
union all
select 'is_system_account_default_false',
  not exists(
    select 1 from public.profiles where is_system_account is distinct from false
  ) as result;
