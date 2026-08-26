select 'charter_fields_column_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'charter_fields'
  ) as result
union all
select 'charter_fields_is_jsonb',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'charter_fields'
      and data_type = 'jsonb'
  ) as result
union all
select 'charter_fields_is_nullable',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'charter_fields'
      and is_nullable = 'YES'
  ) as result
union all
select 'existing_rows_unaffected',
  not exists(
    select 1 from public.documents where charter_fields is not null
  ) as result;
