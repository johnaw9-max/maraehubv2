-- Module KPI Stage 3: monthly locked snapshots of the four module percentages
-- (Compliance, Risk Register, Assets, Goals) shown on Board View.
--
-- Rows are written only by the lock-monthly-kpi-snapshot Edge Function running
-- under the service role — trustees can read but not write, unlike every other
-- table in this schema. The current (in-progress) month is never stored here;
-- it stays live/in-memory in BoardDashboard.js until the month has fully ended.

create table if not exists module_kpi_snapshots (
  id              uuid primary key default gen_random_uuid(),
  snapshot_month  date not null unique,   -- first day of the locked month, e.g. '2026-07-01'
  compliance_pct  integer not null,
  risk_pct        integer not null,
  assets_pct      integer not null,
  goals_pct       integer not null,
  locked_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table module_kpi_snapshots enable row level security;

create policy "module_kpi_snapshots: authenticated read"
  on module_kpi_snapshots for select
  to authenticated
  using (true);

-- Deliberately no insert/update/delete policy for `authenticated` — writes
-- only happen via the service-role key inside the Edge Function.
