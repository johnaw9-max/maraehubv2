-- Fixes the same vacuous-100% bug in module_kpi_snapshots that
-- src/lib/complianceStatus.js's compliancePct and src/lib/riskStatus.js's
-- riskPct already had fixed at the live-display layer (compliancePct
-- 2026-08-23, riskPct same night as this migration): lock-monthly-kpi-snapshot
-- computes its own duplicate of both formulas and, until now, could only
-- ever fall back to 100 on an empty compliance_items/risk_register --
-- because these two columns were `integer not null`, there was no way to
-- write the honest "no data yet" signal even after fixing the function's
-- own math. Confirmed live and real, not hypothetical: LIVE's actual
-- module_kpi_snapshots rows for 2026-06-01 and 2026-07-01 both show
-- compliance_pct: 100, risk_pct: 100 despite 0 real risk_register rows and
-- 0 compliance_items ever assessed (last_checked_date null on all 18) --
-- exactly the false "fully compliant / fully risk-mitigated" reading this
-- whole fix exists to stop.
--
-- assets_pct/goals_pct are NOT touched here -- out of scope, not examined,
-- no evidence either has the same problem in practice.
--
-- Existing locked rows are deliberately NOT backfilled/recomputed here,
-- same "methodology change, not retroactive" precedent already established
-- in lock-monthly-kpi-snapshot/index.ts's own compliancePct comment -- a
-- trend spanning this change will show a jump that is a methodology
-- artifact, not a real change in compliance/risk.

alter table public.module_kpi_snapshots alter column compliance_pct drop not null;
alter table public.module_kpi_snapshots alter column risk_pct drop not null;
