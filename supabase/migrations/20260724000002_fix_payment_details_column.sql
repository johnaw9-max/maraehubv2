-- Re-adds marae_settings.payment_details, which 20260716224853_add_invoicing_fields.sql
-- already declares but which does not exist on Tineka's project (confirmed 2026-07-24 via
-- direct query: selecting the column returns Postgres 42703 "column does not exist").
-- Same class of drift as the auto_workflow_enabled anomaly
-- (see 20260722000002_fix_auto_workflow_enabled_default.sql) — original migration left
-- unmodified since it's already recorded/assumed applied elsewhere.

alter table marae_settings
  add column if not exists payment_details text;
