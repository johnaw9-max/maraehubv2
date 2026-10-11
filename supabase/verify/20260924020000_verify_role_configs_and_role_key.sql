select 'role_configs_table_exists' as check_name,
  exists(select 1 from information_schema.tables where table_name = 'role_configs') as result

union all
select 'role_configs_has_three_seed_rows',
  (select count(*) from role_configs where role_key in ('secretary', 'chairperson', 'treasurer')) = 3

union all
select 'role_configs_rls_enabled',
  exists(select 1 from pg_tables where tablename = 'role_configs' and rowsecurity = true)

union all
select 'role_configs_manage_policy_exists',
  exists(select 1 from pg_policies where tablename = 'role_configs' and policyname = 'authenticated users manage role_configs')

union all
select 'role_configs_view_policy_exists',
  exists(select 1 from pg_policies where tablename = 'role_configs' and policyname = 'authenticated users view role_configs')

union all
select 'role_setup_template_renamed',
  exists(select 1 from workflow_templates where name = 'Role Setup')

union all
select 'workflow_steps_role_key_column_exists',
  exists(select 1 from information_schema.columns where table_name = 'workflow_steps' and column_name = 'role_key')

union all
select 'role_setup_steps_tagged_secretary',
  (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id
   where wt.name = 'Role Setup' and ws.role_key = 'secretary') = 7

union all
select 'workflow_steps_unique_constraint_exists',
  exists(select 1 from pg_constraint where conname = 'workflow_steps_template_role_step_key');
