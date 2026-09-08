-- Adds a real, locked overall Marae Health Score per month, computed by
-- lock-monthly-kpi-snapshot using the same 5-category weighted formula as
-- the live score in BoardDashboard.js (Compliance 25 + Risk 20 + Tasks 20
-- + Finance 20 + Goals 15 = /100). Nullable: a month can lock with too few
-- categories to score (hsInsufficient, matching the live "Not enough data
-- yet" case), same reasoning as the existing nullable compliance_pct/
-- risk_pct columns (20260830000000_make_kpi_pct_columns_nullable.sql).
--
-- Existing locked months (before this migration) have no real 5-category
-- score, since module_kpi_snapshots never captured Tasks or Finance data for
-- them -- see 20260909010000_backfill_health_score_for_existing_months.sql
-- for how those specific months are handled instead (a simpler, honestly
-- different formula using only the 4 percentages that are genuinely real
-- for them, not a reconstruction of the 5-category one below).

alter table module_kpi_snapshots add column if not exists health_score integer;
