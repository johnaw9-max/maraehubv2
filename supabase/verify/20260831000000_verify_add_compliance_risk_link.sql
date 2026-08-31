select 'risk_register_has_compliance_item_id' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'risk_register' and column_name = 'compliance_item_id'
      and data_type = 'uuid' and is_nullable = 'YES'
  ) as result
union all
select 'risk_register_compliance_item_id_fk_restrict',
  exists(
    select 1 from pg_constraint
    where conrelid = 'risk_register'::regclass
      and confrelid = 'compliance_items'::regclass
      and confdeltype = 'r'
  ) as result
union all
select 'compliance_items_has_risk_prompt_dismissed_at',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compliance_items' and column_name = 'risk_prompt_dismissed_at'
      and data_type = 'timestamp with time zone' and is_nullable = 'YES'
  ) as result;
