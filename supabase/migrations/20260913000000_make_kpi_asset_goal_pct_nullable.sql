-- Closes the gap explicitly left open by
-- 20260830000000_make_kpi_pct_columns_nullable.sql ("assets_pct/goals_pct
-- are NOT touched here -- out of scope, not examined, no evidence either
-- has the same problem in practice"). There is now evidence: confirmed live
-- on Opeke, 2026-09-13 -- assets_pct and goals_pct both hit the same
-- vacuous-100% bug as compliance_pct/risk_pct did (empty assets/goals
-- tables silently locking a 100 instead of "no data yet"), for the exact
-- same reason -- these two columns were `integer not null`, so
-- lock-monthly-kpi-snapshot/index.ts had no way to write the honest null
-- even after its own math was fixed to compute one.
--
-- 2026-06-01 and 2026-07-01 rows (all four percentages vacuous 100, not
-- just these two) were deleted rather than backfilled -- no way to
-- reconstruct true historical state, same reasoning as the "not
-- retroactively recomputed" precedent elsewhere in this table. The
-- remaining 2026-08-01 row's goals_pct is corrected to null here as data,
-- not schema -- see the accompanying manual UPDATE.

alter table public.module_kpi_snapshots alter column assets_pct drop not null;
alter table public.module_kpi_snapshots alter column goals_pct drop not null;
