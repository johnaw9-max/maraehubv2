select 'drought_hazard_row_count_still_one' as check_name,
  (select count(*) from emergency_plan_hazards
   where hazard_type = 'Drought / Water Shortage' and entity_id is null) = 1 as result

union all
select 'drought_hazard_likely_impact_mentions_first_flush_diversion',
  exists(
    select 1 from emergency_plan_hazards
    where hazard_type = 'Drought / Water Shortage' and entity_id is null
      and likely_impact ilike '%first-flush diversion%'
  )

union all
select 'drought_hazard_what_to_do_mentions_first_flush_diverter',
  exists(
    select 1 from emergency_plan_hazards
    where hazard_type = 'Drought / Water Shortage' and entity_id is null
      and what_to_do ilike '%first-flush diverter%'
  )

union all
select 'drought_hazard_what_to_do_still_mentions_water_carrier',
  exists(
    select 1 from emergency_plan_hazards
    where hazard_type = 'Drought / Water Shortage' and entity_id is null
      and what_to_do ilike '%trucked water carrier%'
  );
