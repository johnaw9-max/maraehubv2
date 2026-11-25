-- Adds "Heat / Hot weather" as a 12th hazard type (Framework v0.4, 4.3; ClickUp 14yhc7kzqz3).
-- Content only from Health NZ, "Health effects from heat" (source key HNZHEAT, page text read 26 Nov 2026). No heatwave definition is used because the page says there is no official one.
-- entity_id null, like every other hazard type. Insert-only; existing hazards are not changed.

alter table public.emergency_plan_hazards drop constraint if exists emergency_plan_hazards_hazard_type_check;

alter table public.emergency_plan_hazards add constraint emergency_plan_hazards_hazard_type_check
  check (hazard_type = any (array[
    'Landslide', 'Flood', 'Earthquake', 'Fire', 'Storm', 'Tsunami',
    'Volcano', 'Pandemic', 'Man-Made Hazard', 'Water Contamination',
    'Drought / Water Shortage', 'Heat / Hot weather'
  ]));

insert into public.emergency_plan_hazards (hazard_type, entity_id, likely_impact, what_to_do)
select 'Heat / Hot weather', null,
  $q$Hot weather can make people ill, most of all babies, older people, people with health conditions and people living alone. Hui, tangihanga and wānanga bring many people, including kaumātua and tamariki, together for long periods, often in warm buildings, and this raises the risk. New Zealand has no official definition of a heatwave, so a marae should not wait for one before acting. Source: Health NZ, Health effects from heat (page text read 26 Nov 2026).$q$,
  $q$Before: plan drinking water and shade for manuhiri, set aside a cool space, and have a way of checking on kaumātua and anyone else at risk (the community welfare register can help). During: keep checking on those most at risk, and for health advice call Healthline on 0800 611 116. Check the fire season before lighting any outdoor fire, including a hāngī. This is good practice, not a legal duty.$q$
where not exists (
  select 1 from public.emergency_plan_hazards where hazard_type = 'Heat / Hot weather' and entity_id is null
);
