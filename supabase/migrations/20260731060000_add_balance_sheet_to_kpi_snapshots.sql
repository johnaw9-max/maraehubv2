alter table module_kpi_snapshots
  add column net_assets numeric(12,2),
  add column total_assets numeric(12,2),
  add column total_liabilities numeric(12,2);

comment on column module_kpi_snapshots.net_assets is
  'From Xero Balance Sheet, when connected. Null if not Xero-connected or if the Xero fetch failed that month -- never blocks locking the other four percentages.';
comment on column module_kpi_snapshots.total_assets is
  'From Xero Balance Sheet, when connected. Supporting context for net_assets, not a standalone health score.';
comment on column module_kpi_snapshots.total_liabilities is
  'From Xero Balance Sheet, when connected. Supporting context for net_assets, not a standalone health score.';
