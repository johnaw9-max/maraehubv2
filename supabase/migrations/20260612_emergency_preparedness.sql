-- ── EMERGENCY PREPAREDNESS — Compliance Tracker Extension ────────────────────
-- Adds the new category and last_checked_date field.
-- Safe to run on test or live — all statements use IF EXISTS / IF NOT EXISTS.

-- 1. Drop the old category check constraint and recreate with emergency_preparedness
ALTER TABLE compliance_items
  DROP CONSTRAINT IF EXISTS compliance_items_category_check;

ALTER TABLE compliance_items
  ADD CONSTRAINT compliance_items_category_check
  CHECK (category IN (
    'building', 'insurance', 'trustee',
    'health_safety', 'civil_defence', 'other',
    'emergency_preparedness'
  ));

-- 2. Add last_checked_date column (date the item was last physically verified)
ALTER TABLE compliance_items
  ADD COLUMN IF NOT EXISTS last_checked_date DATE;

-- 3. Seed the 10 Emergency Preparedness items only if none exist for this category
INSERT INTO compliance_items (category, name, renewal_months, notes)
SELECT category, name, renewal_months, notes
FROM (VALUES
  ('emergency_preparedness',
   'Civil Defence Emergency Plan — reviewed and up to date',
   12,
   'Must align with local Civil Defence Group plan. Review after any civil defence exercise or event.'),

  ('emergency_preparedness',
   'Emergency contact list — trustees, key community members, Civil Defence coordinator',
   6,
   'Include cell numbers, alternative contacts, and local Civil Defence coordinator details.'),

  ('emergency_preparedness',
   'Generator — tested, fuelled, serviced',
   3,
   'Test under load monthly. Fuel stabiliser if stored long-term. Log every test run.'),

  ('emergency_preparedness',
   'Water supply — 10,000L tank or alternative checked',
   6,
   'Inspect tank for leaks, contamination, and pump operation. Confirm potability.'),

  ('emergency_preparedness',
   'Emergency food and supply kit — stocked and checked',
   6,
   'Check expiry dates on food and medications. Minimum 72-hour supply for likely occupancy.'),

  ('emergency_preparedness',
   'Community welfare register — vulnerable whānau who need checking on',
   12,
   'List of kaumātua, disabled whānau, and others who may need welfare checks during an emergency. Keep private and current.'),

  ('emergency_preparedness',
   'First aid kit — stocked and in date',
   6,
   'Check all consumables for expiry. Restock after any use. Ensure AED pads/battery checked if applicable.'),

  ('emergency_preparedness',
   'Evacuation routes — identified and communicated to committee',
   12,
   'Post maps in the marae. Brief all trustees and key volunteers. Include accessibility routes.'),

  ('emergency_preparedness',
   'Emergency communications plan — contact community if power/internet down',
   12,
   'Document the plan: phone trees, community radio channel, meeting point. Test annually.'),

  ('emergency_preparedness',
   'Marae structure — roof, walls, foundations checked for storm readiness',
   6,
   'Visual inspection after major weather events. Engage qualified builder for structural assessment annually.')
) AS v(category, name, renewal_months, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM compliance_items WHERE category = 'emergency_preparedness'
);
