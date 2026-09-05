select 'service_reminders_asset_id_fk_exists' as check_name,
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'service_reminders' and constraint_name = 'service_reminders_asset_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ) as result

union all
select 'fk_references_assets_table',
  exists(
    select 1
    from information_schema.constraint_column_usage ccu
    where ccu.constraint_name = 'service_reminders_asset_id_fkey'
      and ccu.table_name = 'assets'
  )

union all
select 'fk_delete_rule_is_cascade',
  exists(
    select 1 from information_schema.referential_constraints
    where constraint_name = 'service_reminders_asset_id_fkey' and delete_rule = 'CASCADE'
  )

union all
select 'postgrest_can_now_embed_assets_via_service_reminders',
  exists(
    select 1 from pg_constraint
    where conname = 'service_reminders_asset_id_fkey' and contype = 'f'
  );
