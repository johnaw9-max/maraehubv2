-- SUPERSEDED (2026-07-22): recorded as applied in
-- supabase_migrations.schema_migrations on both live projects, but the
-- column never actually existed - anomaly, cause undetermined. Do not run
-- this file as-is. See 20260722000002_fix_auto_workflow_enabled_default.sql,
-- which also corrects the default from true to false. Left unmodified below
-- since it's already marked applied and editing it in place would drift
-- from what Supabase's migration history thinks ran.

-- Add opt-out flag to service_reminders.
-- When auto_workflow_enabled = false a trustee has opted this reminder out
-- of the daily auto-workflow trigger in check-deadlines.

alter table service_reminders
  add column if not exists auto_workflow_enabled boolean not null default true;
