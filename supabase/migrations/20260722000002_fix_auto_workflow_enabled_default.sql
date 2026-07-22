-- Corrects the default for service_reminders.auto_workflow_enabled, and
-- re-adds the column itself since it never actually took effect.
--
-- Anomaly discovered 2026-07-22: migration 20260624_service_reminder_auto_workflow.sql
-- is recorded as applied in supabase_migrations.schema_migrations on both
-- Opeke and (pending check) Tineka, with the correct DDL stored verbatim in
-- its `statements` record, yet the column genuinely does not exist on either
-- live project. Root cause not determined - ruled out: stale connection,
-- a later migration dropping/rebuilding the table, and collateral damage
-- from a batched push failure (both neighboring migrations, 20260619 and
-- 20260705, applied normally). Not investigated further given a live fix
-- is more urgent than root-causing a month-old anomaly.
--
-- Original file intentionally left unmodified (see pointer comment added to
-- it) rather than edited in place, since it's already marked applied and
-- editing it would create the same drift risk fixed in
-- 20260722000000_fix_cron_vault_auth.sql.
--
-- Default changed from true to false: since the column has never existed,
-- the auto-workflow feature has been silently inert since 2026-06-24. Every
-- existing service_reminder has therefore never been "opted in" in practice.
-- Defaulting to true here would retroactively and silently opt every
-- existing reminder in on a live customer project, likely creating a burst
-- of real workflow_instances/tasks on the next check-deadlines run with no
-- warning. Defaulting to false preserves current (inert) behavior for
-- existing data; opt-in going forward should be a deliberate trustee action.

alter table service_reminders
  add column if not exists auto_workflow_enabled boolean not null default false;

-- Unconditional, so a hypothetical fresh project where 20260624 ran for
-- real (default true) still ends up correct here too.
alter table service_reminders
  alter column auto_workflow_enabled set default false;
