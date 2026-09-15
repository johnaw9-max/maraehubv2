-- Maintenance shield, migration_tracking_drift check.
--
-- supabase_migrations.schema_migrations isn't reachable from check-deadlines
-- via PostgREST - same wall every other cross-schema check in this file has
-- hit (information_schema, cron, auth) - same fix: a SECURITY DEFINER
-- wrapper, same shape as get_public_schema_columns() (20260811000000).
--
-- Real reason this check exists: the migration-tracking drift investigation
-- ([[project_maraehubv2_migration_drift]]) found ~90 real migrations applied
-- to Opeke via direct db query/SQL editor rather than `supabase db push`,
-- so schema_migrations never recorded them - fully invisible to every
-- existing check, since schema_drift only diffs schema.sql against live
-- table/column structure, never this tracking table.
--
-- version only, not name/statements - statements would include full
-- migration SQL text (potentially sensitive), and this check only needs the
-- version string to diff against expectedMigrations.ts's local file list.

create or replace function public.get_schema_migrations_versions()
returns table(version text)
language sql
security definer
set search_path = public
as $$
  select version::text from supabase_migrations.schema_migrations order by version;
$$;

-- `revoke ... from public` alone was NOT sufficient here (confirmed live on
-- Tineka: anon/authenticated/postgres all still had EXECUTE after that
-- alone, unlike get_public_schema_columns' identical-looking revoke,
-- cause not fully explained -- likely a default-privileges scope
-- difference from how this migration was applied). Revoking from anon and
-- authenticated explicitly, not just public, is what actually worked.
revoke execute on function public.get_schema_migrations_versions() from public, anon, authenticated;
grant execute on function public.get_schema_migrations_versions() to service_role;
