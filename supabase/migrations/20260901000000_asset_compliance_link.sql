-- Assets -> Maintenance -> Compliance link (86d44k695). Real, live
-- duplication confirmed on Opeke before building: the "Fire
-- Extinguishers" asset (with its own service reminder) and the
-- "Fire extinguishers -- inspected and serviced" compliance item both
-- independently track the same real-world obligation, with zero
-- connection -- marking one done leaves the other showing overdue.
--
-- ON DELETE SET NULL, not RESTRICT (unlike risk_register's link
-- columns): AssetsManager.js's handleMarkServiced() deletes a one-time
-- (recurring: 'none') reminder outright once serviced. RESTRICT would
-- throw a real FK violation and block that existing, unrelated
-- behavior; SET NULL just drops the link and lets it keep working.
alter table compliance_items
  add column linked_service_reminder_id uuid references service_reminders(id) on delete set null;

-- Real, reviewed, narrow backfill -- Fire Extinguishers only, the one
-- pair confirmed to exist on both sides. Name-matched, not
-- ID-hardcoded, so it is naturally a no-op on any project where these
-- exact names don't both exist -- confirmed empirically: 0 rows on the
-- test project (no Fire Extinguishers/Fire Alarms assets there).
-- Opeke's "Fire alarms -- tested and detection confirmed working"
-- compliance item does not exist at all (confirmed directly, separate
-- real gap, logged on its own ClickUp item, not backfilled here since
-- there is nothing real to link it to).
update compliance_items ci
set linked_service_reminder_id = sr.id
from service_reminders sr
join assets a on a.id = sr.asset_id
where ci.name = 'Fire extinguishers — inspected and serviced'
  and a.name = 'Fire Extinguishers'
  and ci.linked_service_reminder_id is null;
