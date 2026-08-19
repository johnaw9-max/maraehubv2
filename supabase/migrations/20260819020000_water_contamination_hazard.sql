-- Stage 2 of the Water Safety Readiness work (ClickUp 86d42u3pp). Adds
-- 'Water Contamination' as a tenth hazard type in Emergency Plan, with
-- real content sourced directly from current Taumata Arowai guidance
-- (fetched 19 Aug 2026) -- same pattern as the existing Fire entry.
-- entity_id null, matching how all other hazard types are seeded --
-- shared across a project, not per-entity.

alter table public.emergency_plan_hazards drop constraint emergency_plan_hazards_hazard_type_check;

alter table public.emergency_plan_hazards add constraint emergency_plan_hazards_hazard_type_check
  check (hazard_type = any (array[
    'Landslide', 'Flood', 'Earthquake', 'Fire', 'Storm', 'Tsunami',
    'Volcano', 'Pandemic', 'Man-Made Hazard', 'Water Contamination'
  ]));

insert into public.emergency_plan_hazards (hazard_type, entity_id, likely_impact, what_to_do)
select 'Water Contamination', null,
  'A marae''s drinking water supply can become unsafe through source contamination, a treatment or filtration fault, a burst or compromised pipe, or a failure in a tank, pump or UV/chlorination system. Most marae water supplies are classified by Taumata Arowai as non-residential or community supplies rather than exempt domestic self-supplies, so real legal obligations apply even to small or occasional-use systems -- the exact obligations depend on your supply''s classification and size. Risk is highest during large gatherings (tangihanga, hui, wānanga) when demand and occupancy are at their peak and any failure affects the most people at once.',
  'If you suspect the water may be unsafe: stop drinking it immediately and use only boiled or bottled water for drinking, cooking and brushing teeth until it is confirmed safe. Advise everyone on site straight away -- do not wait for test results before warning people. Notify Taumata Arowai as soon as possible; for an imminent risk of serious illness or death, call their 24/7 hotline on 0800 454 717 outside normal business hours (Mon-Fri, 8am-5pm), or use their standard notify-us process for less urgent issues. Arrange retesting with a real testing provider before resuming normal use, and keep a written record of what happened, who was told, and when the all-clear was given.'
where not exists (
  select 1 from public.emergency_plan_hazards where hazard_type = 'Water Contamination' and entity_id is null
);
