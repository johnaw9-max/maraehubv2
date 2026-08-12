-- Found via Stage 2d's schema_drift check (ClickUp 86d3u7790), then
-- investigated directly rather than assumed: of 5 remaining drift items
-- between Tineka and Opeke, 2 are genuine functional gaps on Tineka --
-- both marae_settings.bank_csv_mapping and .founder_metrics are actively
-- read and written by live app code (BankReconciliation.js,
-- FounderDashboard.js respectively), confirmed via direct grep against
-- src/, not inferred from the schema difference alone. Opeke already has
-- both (types confirmed via the freshly re-synced schema.sql: both jsonb,
-- nullable, no default).
--
-- The other 3 items found in the same investigation (feedback.marae, the
-- 8 dead finance_balance_sheet investment/liability columns, and
-- profiles.last_sign_in_at) were confirmed to have zero live code usage
-- and are deliberately left alone here -- logged separately as low-
-- priority documentation cleanup, not functional gaps.
--
-- Idempotent / safe to re-run.

alter table marae_settings add column if not exists founder_metrics jsonb;
alter table marae_settings add column if not exists bank_csv_mapping jsonb;
