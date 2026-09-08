select 'jun_2026_health_score_backfilled' as check_name,
  (select health_score from module_kpi_snapshots where snapshot_month = '2026-06-01') is not null as result

union all
select 'jul_2026_health_score_backfilled',
  (select health_score from module_kpi_snapshots where snapshot_month = '2026-07-01') is not null

union all
select 'aug_2026_health_score_backfilled',
  (select health_score from module_kpi_snapshots where snapshot_month = '2026-08-01') is not null

union all
select 'aug_2026_health_score_matches_simple_average',
  (select health_score from module_kpi_snapshots where snapshot_month = '2026-08-01') =
  (select round((compliance_pct + risk_pct + assets_pct + goals_pct) / 4.0)
     from module_kpi_snapshots where snapshot_month = '2026-08-01');
