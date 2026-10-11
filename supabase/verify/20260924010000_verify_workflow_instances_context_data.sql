select 'workflow_instances_context_data_exists' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'workflow_instances' and column_name = 'context_data' and data_type = 'jsonb'
  ) as result;
