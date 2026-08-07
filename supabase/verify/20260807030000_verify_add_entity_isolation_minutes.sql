-- Verify-file for migration 20260807030000_add_entity_isolation_minutes.sql.
-- Run via scripts/deploy-migration.sh as the second (verify-file) argument.
-- Structural checks only - the real behavioral proof (positive/negative/
-- admin-bypass/inheritance/null-meeting_id-rejection/cross-entity) is
-- done separately via impersonated db query sessions, not here.

select 'meetings_entity_id_column_exists' as check_name,
  exists(select 1 from information_schema.columns where table_name = 'meetings' and column_name = 'entity_id') as result
union all
select 'resolutions_meeting_id_not_null',
  coalesce((select is_nullable = 'NO' from information_schema.columns where table_name = 'resolutions' and column_name = 'meeting_id'), false)
union all
select 'meeting_actions_meeting_id_not_null',
  coalesce((select is_nullable = 'NO' from information_schema.columns where table_name = 'meeting_actions' and column_name = 'meeting_id'), false)
union all
select 'resolutions_has_no_entity_id_column',
  not exists(select 1 from information_schema.columns where table_name = 'resolutions' and column_name = 'entity_id')
union all
select 'meeting_actions_has_no_entity_id_column',
  not exists(select 1 from information_schema.columns where table_name = 'meeting_actions' and column_name = 'entity_id')
union all
select 'meetings_select_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meetings' and policyname = 'meetings_select')
union all
select 'meetings_insert_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meetings' and policyname = 'meetings_insert')
union all
select 'meetings_update_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meetings' and policyname = 'meetings_update')
union all
select 'meetings_delete_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meetings' and policyname = 'meetings_delete')
union all
select 'resolutions_select_policy_exists',
  exists(select 1 from pg_policies where tablename = 'resolutions' and policyname = 'resolutions_select')
union all
select 'resolutions_insert_policy_exists',
  exists(select 1 from pg_policies where tablename = 'resolutions' and policyname = 'resolutions_insert')
union all
select 'resolutions_update_policy_exists',
  exists(select 1 from pg_policies where tablename = 'resolutions' and policyname = 'resolutions_update')
union all
select 'resolutions_delete_policy_exists',
  exists(select 1 from pg_policies where tablename = 'resolutions' and policyname = 'resolutions_delete')
union all
select 'meeting_actions_select_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meeting_actions' and policyname = 'meeting_actions_select')
union all
select 'meeting_actions_insert_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meeting_actions' and policyname = 'meeting_actions_insert')
union all
select 'meeting_actions_update_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meeting_actions' and policyname = 'meeting_actions_update')
union all
select 'meeting_actions_delete_policy_exists',
  exists(select 1 from pg_policies where tablename = 'meeting_actions' and policyname = 'meeting_actions_delete')
union all
select 'old_meetings_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'meetings' and policyname in ('meetings: authenticated full access', 'allow_authenticated'))
union all
select 'old_resolutions_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'resolutions' and policyname in ('resolutions: authenticated full access', 'allow_authenticated'))
union all
select 'old_meeting_actions_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'meeting_actions' and policyname in ('meeting_actions: authenticated full access', 'allow_authenticated'));
