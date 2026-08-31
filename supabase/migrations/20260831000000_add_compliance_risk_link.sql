-- Compliance -> Risk suggestion prompt (86d44k66b). Two independent
-- additions, one feature:
--
-- 1. risk_register.compliance_item_id -- links a risk back to the
--    compliance item it was suggested from. Nullable, optional FK, same
--    shape as this table's existing entity_id/asset_id link columns.
--    ON DELETE RESTRICT matches those columns' real, live behavior --
--    confirmed via information_schema before choosing this, not assumed
--    from schema.sql, which turned out to be stale for asset_id
--    (see 14yhc7knrw2, a separate fix, not bundled in here).
--
-- 2. compliance_items.risk_prompt_dismissed_at -- cooldown timestamp for
--    the suggestion banner, same shape as this table's existing
--    last_reminded_at column (used for the overdue-compliance email
--    reminder's own 7-day throttle).

alter table risk_register
  add column compliance_item_id uuid references compliance_items(id) on delete restrict;

alter table compliance_items
  add column risk_prompt_dismissed_at timestamp with time zone;
