-- Real, app-layer data-export tracking (14yhc7kpfz3 Step 3).
--
-- Real, honest scope, checked before building anything: an audit of the
-- whole codebase found exactly one genuine bulk-export feature --
-- exportAccountantCSV() in FinanceManager.js. Everything else is either a
-- single-item download (one document, one invoice) or a print view of
-- already-visible data, not an export. This table and check cover that one
-- feature only, not BoardDashboard's routine per-page-load table reads
-- (~20 parallel queries on every mount, for every user -- normal baseline
-- behaviour, not a meaningful export signal).
--
-- Real, honest scale note: both real projects' entire transaction history
-- combined is under 10 rows as of this migration (test project: 3 income +
-- 1 expense; Opeke: 2 income + 0 expense). "Historical baseline per
-- account" isn't a meaningful statistic yet at this org's real scale --
-- built as a flat absolute-size threshold instead of per-account baseline
-- tracking, matching the actual data rather than over-building for a
-- problem this app doesn't have yet.
--
-- export_type is a free-text column (not an enum) so future export
-- features can log here too without a migration, even though only
-- 'finance_accountant_csv' is wired up right now.
--
-- Same precedent as login_attempts (20260911020000): this is self-reported
-- from the client at export time, same spoofability caveat -- a first-layer
-- signal for the common case, not a defense against a user who deliberately
-- avoids triggering the log.
create table if not exists export_log (
  id uuid not null default gen_random_uuid(),
  account_email text not null,
  export_type text not null,
  row_count integer not null,
  exported_at timestamptz not null default now()
);

alter table export_log add constraint export_log_pkey PRIMARY KEY (id);

create index if not exists export_log_account_email_exported_at_idx
  on export_log (account_email, exported_at);

alter table export_log enable row level security;

-- authenticated only, not anon -- exporting requires being logged in and
-- having Finance access already (FinanceManager is trustee-gated), unlike
-- login_attempts which necessarily happens pre-auth. No select/update/
-- delete policy for authenticated at all -- correctly denied outright
-- under RLS. service_role (check-deadlines) bypasses RLS entirely.
create policy "export_log: authenticated can insert"
  on export_log for insert
  to authenticated
  with check (true);
