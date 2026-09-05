-- Post #15 (Water Scarcity/Drought Preparedness, El Nino-tied). Real
-- audit found MaraeHub's existing "Water" content (Water Contamination
-- hazard, Water compliance category, Water Contamination Response
-- workflow -- all from the Water Safety Readiness work, ClickUp
-- 86d42u3pp) is entirely about water becoming unsafe to drink, never
-- about the supply running short. Adds "Drought / Water Shortage" as an
-- 11th hazard type, real content sourced from Civil Defence/Get Ready,
-- NIWA/Earth Sciences NZ, Taumata Arowai's dry-weather guidance, and MPI
-- (fetched 4 Sept 2026). entity_id null, matching every other hazard
-- type -- shared across a project, not per-entity.

alter table public.emergency_plan_hazards drop constraint emergency_plan_hazards_hazard_type_check;

alter table public.emergency_plan_hazards add constraint emergency_plan_hazards_hazard_type_check
  check (hazard_type = any (array[
    'Landslide', 'Flood', 'Earthquake', 'Fire', 'Storm', 'Tsunami',
    'Volcano', 'Pandemic', 'Man-Made Hazard', 'Water Contamination',
    'Drought / Water Shortage'
  ]));

insert into public.emergency_plan_hazards (hazard_type, entity_id, likely_impact, what_to_do)
select 'Drought / Water Shortage', null,
  'Drought and prolonged dry weather can leave a marae''s water supply critically low or fully restricted, whether the supply is a tank, a bore, or a council connection subject to restrictions. Earth Sciences New Zealand (NIWA) declared a "Very Strong" El Nino on 2 July 2026, with peak effects expected over spring and summer 2026/27 and the greatest risk of below-normal rainfall over the northern and eastern North Island and the eastern South Island. Risk is highest during large gatherings (tangihanga, hui, wananga), when water demand is at its peak and a shortage affects the most people at once, and for marae relying on a rainwater tank or a single bore with no backup source.',
  'Before: know your real tank capacity and how many days of normal use it represents, and keep the Civil Defence-recommended emergency minimum -- at least 3 litres of drinking water per person per day, for 3 or more days -- genuinely separate from everyday use, not counted as part of it. If you rely on a trucked water carrier, confirm now that the provider is on Taumata Arowai''s real Public Register of Drinking Water Supplies (Hinekorako), before you actually need to book one. Monitor your regional council and the real NZ Drought Index (NIWA/MPI) for your district as spring and summer approach. During: follow every restriction your water supplier or council issues exactly as instructed, and ration non-essential use (gardens, washing vehicles, topping up pools) immediately once dry conditions are forecast, before restrictions become mandatory. If your regular supply fails and only untreated rainwater, bore or stream water remains, do not use it for drinking, cooking or brushing teeth unless it has been boiled -- it is fine for laundry, cleaning or toilet flushing. After: restock your emergency reserve, log what happened and any real costs, and contact your local Rural Support Trust if this was part of a wider declared drought event.'
where not exists (
  select 1 from public.emergency_plan_hazards where hazard_type = 'Drought / Water Shortage' and entity_id is null
);
