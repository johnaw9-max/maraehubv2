select 'drought_hazard_type_allowed' as check_name,
  exists(
    select 1 from information_schema.check_constraints
    where constraint_name = 'emergency_plan_hazards_hazard_type_check'
      and check_clause like '%Drought / Water Shortage%'
  ) as result

union all
select 'drought_hazard_content_seeded',
  exists(
    select 1 from emergency_plan_hazards
    where hazard_type = 'Drought / Water Shortage' and entity_id is null
      and likely_impact like '%Very Strong%El Nino%'
      and what_to_do like '%3 litres of drinking water per person per day%'
      and what_to_do like '%Hinekorako%'
  )

union all
select 'no_duplicate_drought_hazard_rows',
  (select count(*) from emergency_plan_hazards where hazard_type = 'Drought / Water Shortage' and entity_id is null) = 1

union all
select 'existing_hazard_types_still_intact',
  (select count(distinct hazard_type) from emergency_plan_hazards
   where hazard_type in ('Landslide','Flood','Earthquake','Fire','Storm','Tsunami','Volcano','Pandemic','Man-Made Hazard','Water Contamination')
     and entity_id is null) = 10

union all
select 'drought_workflow_template_exists',
  exists(select 1 from workflow_templates where name = 'Drought / Water Shortage Response')

union all
select 'drought_workflow_has_9_steps',
  (select count(*) from workflow_steps ws
   join workflow_templates wt on wt.id = ws.template_id
   where wt.name = 'Drought / Water Shortage Response') = 9

union all
select 'drought_workflow_steps_correctly_ordered',
  (select count(*) from (
    select step_order, row_number() over (order by step_order) as rn
    from workflow_steps ws join workflow_templates wt on wt.id = ws.template_id
    where wt.name = 'Drought / Water Shortage Response'
  ) t where step_order <> rn) = 0

union all
select 'drought_workflow_not_linked_to_any_compliance_item',
  not exists(
    select 1 from compliance_items where workflow_template_id = (
      select id from workflow_templates where name = 'Drought / Water Shortage Response'
    )
  )

union all
select 'water_contamination_content_untouched',
  exists(
    select 1 from emergency_plan_hazards
    where hazard_type = 'Water Contamination' and entity_id is null
      and what_to_do like '%0800 454 717%'
  );
