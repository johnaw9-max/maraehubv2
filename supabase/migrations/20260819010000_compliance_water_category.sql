-- Stage 1 of the Water Safety Readiness work (ClickUp 86d42u3pp). Adds
-- 'water' as an eighth compliance category, same shape as every existing
-- one -- no new table, no new architecture.

alter table public.compliance_items drop constraint compliance_items_category_check;

alter table public.compliance_items add constraint compliance_items_category_check
  check (category = any (array[
    'building', 'insurance', 'trustee', 'health_safety',
    'civil_defence', 'other', 'emergency_preparedness', 'water'
  ]));
