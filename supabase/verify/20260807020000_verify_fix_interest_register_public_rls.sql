-- Verify-file for migration 20260807020000_fix_interest_register_public_rls.sql.
-- Run via scripts/deploy-migration.sh as the second (verify-file) argument.
-- Structural checks only - the real behavioral proof (unauthenticated
-- access now blocked, negative/admin-bypass/positive/cross-entity) is
-- done separately via impersonated db query sessions, not here.

select 'interest_register_entity_id_column_exists' as check_name,
  exists(select 1 from information_schema.columns where table_name = 'interest_register' and column_name = 'entity_id') as result
union all
select 'select_policy_exists',
  exists(select 1 from pg_policies where tablename = 'interest_register' and policyname = 'interest_register_select')
union all
select 'insert_policy_exists',
  exists(select 1 from pg_policies where tablename = 'interest_register' and policyname = 'interest_register_insert')
union all
select 'update_policy_exists',
  exists(select 1 from pg_policies where tablename = 'interest_register' and policyname = 'interest_register_update')
union all
select 'delete_policy_exists',
  exists(select 1 from pg_policies where tablename = 'interest_register' and policyname = 'interest_register_delete')
union all
select 'old_public_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'interest_register' and policyname = 'Trustees can manage interest register')
union all
select 'no_policy_grants_to_public_role',
  not exists(select 1 from pg_policies where tablename = 'interest_register' and roles::text like '%public%');
