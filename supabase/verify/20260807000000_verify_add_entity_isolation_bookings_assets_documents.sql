-- Verify-file for migration 20260807000000_add_entity_isolation_bookings_assets_documents.sql.
-- Run via scripts/deploy-migration.sh as the second (verify-file) argument.
-- Structural checks only (columns/policies exist, old policies replaced) -
-- the real behavioral proof (negative/admin-bypass/positive, plus the
-- bookings-specific community-isolation test) is done separately via
-- impersonated db query sessions, not here.

select 'bookings_entity_id_column_exists' as check_name,
  exists(select 1 from information_schema.columns where table_name = 'bookings' and column_name = 'entity_id') as result
union all
select 'assets_entity_id_column_exists',
  exists(select 1 from information_schema.columns where table_name = 'assets' and column_name = 'entity_id')
union all
select 'documents_entity_id_column_exists',
  exists(select 1 from information_schema.columns where table_name = 'documents' and column_name = 'entity_id')
union all
select 'bookings_policy_updated',
  exists(select 1 from pg_policies where tablename = 'bookings' and policyname = 'Trustees within entity or own bookings')
union all
select 'assets_policy_updated',
  exists(select 1 from pg_policies where tablename = 'assets' and policyname = 'Trustees can manage assets within their entities')
union all
select 'documents_policy_updated',
  exists(select 1 from pg_policies where tablename = 'documents' and policyname = 'Trustees can manage documents within their entities')
union all
select 'old_bookings_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'bookings' and policyname = 'bookings: authenticated full access')
union all
select 'old_assets_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'assets' and policyname = 'assets: authenticated full access')
union all
select 'old_documents_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'documents' and policyname = 'documents: authenticated full access');
