-- ClickUp 86d42yxhx Task 2: links risk_register to assets, mirroring the
-- existing entity_id FK pattern exactly (nullable, ON DELETE RESTRICT).
alter table risk_register add column asset_id uuid;
alter table risk_register add constraint risk_register_asset_id_fkey
  foreign key (asset_id) references assets(id) on delete restrict;
