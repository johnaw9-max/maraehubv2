select 'marae_settings_has_seven_profile_columns' as check_name,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'marae_settings'
      and column_name in ('entities','contacts','tools_config','marae_address','marae_phone','sub_committees','custom_tools')) = 7 as result
union all
select 'jsonb_columns_are_jsonb',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'marae_settings'
      and column_name in ('entities','contacts','tools_config','sub_committees','custom_tools')
      and data_type = 'jsonb') = 5;
