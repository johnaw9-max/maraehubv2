select 'resolution_id_column_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meeting_actions' and column_name = 'resolution_id'
  ) as result
union all
select 'resolution_id_is_uuid',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meeting_actions' and column_name = 'resolution_id'
      and data_type = 'uuid'
  ) as result
union all
select 'resolution_id_is_nullable',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meeting_actions' and column_name = 'resolution_id'
      and is_nullable = 'YES'
  ) as result
union all
select 'resolution_id_fk_references_resolutions_on_delete_set_null',
  exists(
    select 1 from pg_constraint
    where conrelid = 'public.meeting_actions'::regclass
      and contype = 'f'
      and conname = 'meeting_actions_resolution_id_fkey'
      and pg_get_constraintdef(oid) = 'FOREIGN KEY (resolution_id) REFERENCES resolutions(id) ON DELETE SET NULL'
  ) as result
union all
select 'existing_rows_unaffected',
  not exists(
    select 1 from public.meeting_actions where resolution_id is not null
  ) as result;
