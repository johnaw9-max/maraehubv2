-- One-time backfill of health_score for the 3 months locked before that
-- column existed (Jun/Jul/Aug 2026) -- see 20260909000000_add_health_score_
-- to_kpi_snapshots.sql. Deliberately NOT the live 5-category formula
-- (Compliance/Risk/Tasks/Finance/Goals) -- Tasks and Finance data was never
-- captured for these months, so there is no honest way to reconstruct that
-- score. Instead: a plain average of the 4 percentages that genuinely ARE
-- real and already stored for every one of these months (compliance_pct,
-- risk_pct, assets_pct, goals_pct) -- simpler, but 100% real data, no
-- fabrication.
--
-- This is a real methodology difference from the 5-category score every
-- month from here forward will use -- a trend line crossing from a
-- backfilled month into a real one may show a jump or dip that is a
-- methodology artifact, not a real change in marae health. Same caveat
-- already documented for the compliance_pct formula change
-- (lock-monthly-kpi-snapshot/index.ts).
--
-- Guarded to only touch rows that are still null and have all 4 source
-- percentages present -- never overwrites a real 5-category score the edge
-- function already locked.

update module_kpi_snapshots
set health_score = round((compliance_pct + risk_pct + assets_pct + goals_pct) / 4.0)
where health_score is null
  and compliance_pct is not null
  and risk_pct is not null
  and assets_pct is not null
  and goals_pct is not null;
