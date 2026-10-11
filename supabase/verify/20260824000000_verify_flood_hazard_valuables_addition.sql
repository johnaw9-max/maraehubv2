select 'flood_before_has_valuables_addition' as check_name,
  exists(
    select 1 from public.emergency_plan_hazards
    where hazard_type = 'Flood' and entity_id is null
      and what_to_do like '%move taonga, important documents and equipment as high above the floor as possible%'
  ) as result
union all
select 'flood_before_original_content_intact',
  exists(
    select 1 from public.emergency_plan_hazards
    where hazard_type = 'Flood' and entity_id is null
      and what_to_do like '%agree a real evacuation route to higher ground%'
      and what_to_do like '%never walk, swim or drive through floodwater%'
      and what_to_do like '%throw away any food or water that came into contact with floodwater.'
  ) as result;
