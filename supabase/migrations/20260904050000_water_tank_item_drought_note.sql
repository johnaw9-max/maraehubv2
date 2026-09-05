-- Post #15 (Water Scarcity/Drought Preparedness). Backfills the real,
-- already-provisioned "Water supply -- 10,000L tank or alternative
-- checked" compliance item on real live data -- not just updating the
-- EP_SEED_ITEMS template in ComplianceTracker.js, which only affects a
-- fresh marae going forward. Confirmed via direct query before writing
-- this: the item already exists with the old notes on both real live
-- projects. Matched on the exact old notes text, not just the name, so
-- this never overwrites a trustee's own edit to the notes.

update compliance_items
set notes = 'Inspect tank for leaks, contamination, and pump operation. Confirm potability. Also confirm the tank represents a real reserve above everyday use — see the Drought / Water Shortage hazard in Emergency Plan for the recommended minimum (3L/person/day, 3+ days).'
where name = 'Water supply — 10,000L tank or alternative checked'
  and notes = 'Inspect tank for leaks, contamination, and pump operation. Confirm potability.';
