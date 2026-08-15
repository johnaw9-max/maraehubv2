-- Stage 3 (86d41epk8): links Workflow-classified compliance_items to real
-- workflow_templates. One column, one already-existing template wired up,
-- one duplicate resolved, five new templates built for the real gaps found
-- in Stage 3's audit.

-- 1. The link itself.
alter table public.compliance_items
  add column workflow_template_id uuid references public.workflow_templates(id);

-- 2. Zero-new-content win: "Civil Defence Emergency Plan Review" was
-- reclassified Template -> Workflow this session after its real,
-- already-existing 10-step workflow_template was checked and found to
-- match. Just wire it up.
update public.compliance_items
set workflow_template_id = (
  select id from public.workflow_templates where name = 'Civil Defence Emergency Plan Review'
)
where id = '359e66c3-40ae-4c54-81b8-f43978ef82e4';

-- 3. Duplicate resolution: "Emergency Evacuation Drill" and CD Plan
-- Review's own step 7 ("Run emergency drill") are the same real
-- obligation tracked twice -- same pattern as Stage 1's 3 duplicate
-- pairs. Folded into CD Plan Review, not a separate template.
delete from public.compliance_items where id = '75398129-67f1-45c8-9dc8-0a7c8e845505';

-- 4. Five new templates, content drawn from each compliance item's own
-- existing notes field, matching the established quality bar of the
-- other 18 real templates already in this table.

with ins as (
  insert into public.workflow_templates (name, description, category)
  values ('Generator Test and Service', 'Monthly load test, fuel check, and service log for the marae backup generator.', 'compliance')
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description)
select id, 1, 'Start generator and run under load', 'Run for at least 15 minutes under load' from ins
union all select id, 2, 'Check fuel level and top up', '' from ins
union all select id, 3, 'Add fuel stabiliser if stored long-term', 'Needed if fuel has been sitting more than 3 months' from ins
union all select id, 4, 'Inspect for oil leaks, wear, or damage', '' from ins
union all select id, 5, 'Check battery and starter condition', '' from ins
union all select id, 6, 'Log test date, run time, and any issues found', '' from ins
union all select id, 7, 'Schedule next test date', '' from ins;

update public.compliance_items
set workflow_template_id = (select id from public.workflow_templates where name = 'Generator Test and Service')
where id = 'd6b83cf7-0c50-4ab6-ad9c-472dd2919853';

with ins as (
  insert into public.workflow_templates (name, description, category)
  values ('Water Tank Inspection', 'Six-monthly inspection of the emergency water supply tank for leaks, contamination, and pump operation.', 'compliance')
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description)
select id, 1, 'Inspect tank exterior and fittings for leaks', '' from ins
union all select id, 2, 'Check water level and top up if needed', '' from ins
union all select id, 3, 'Inspect for visible contamination', 'Debris, algae, discolouration' from ins
union all select id, 4, 'Test pump operation and pressure', '' from ins
union all select id, 5, 'Confirm potability', 'Test or visual/smell check per local guidance' from ins
union all select id, 6, 'Clean tank inlet or filter if required', '' from ins
union all select id, 7, 'Log inspection date and findings', '' from ins;

update public.compliance_items
set workflow_template_id = (select id from public.workflow_templates where name = 'Water Tank Inspection')
where id = '3af2da8e-4d73-4811-bbae-273a3723d3a1';

with ins as (
  insert into public.workflow_templates (name, description, category)
  values ('Evacuation Routes Review', 'Annual review and communication of marae evacuation routes, including accessibility routes.', 'compliance')
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description)
select id, 1, 'Review and update evacuation route maps', '' from ins
union all select id, 2, 'Confirm accessibility routes are included', 'For those with mobility needs' from ins
union all select id, 3, 'Print and post maps at key locations in the marae', '' from ins
union all select id, 4, 'Brief all trustees on evacuation routes', '' from ins
union all select id, 5, 'Brief key volunteers on evacuation routes', '' from ins
union all select id, 6, 'Log briefing date and attendees', '' from ins;

update public.compliance_items
set workflow_template_id = (select id from public.workflow_templates where name = 'Evacuation Routes Review')
where id = '029cdcd0-0e65-42ea-b7d5-9efac9e00756';

with ins as (
  insert into public.workflow_templates (name, description, category)
  values ('Marae Structure Storm Readiness Check', 'Six-monthly visual inspection of the marae structure for storm readiness.', 'compliance')
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description)
select id, 1, 'Visually inspect roof for damage or wear', '' from ins
union all select id, 2, 'Visually inspect exterior walls and foundations', '' from ins
union all select id, 3, 'Check drainage and guttering are clear', '' from ins
union all select id, 4, 'Note any issues requiring urgent repair', '' from ins
union all select id, 5, 'Confirm whether the annual qualified-builder structural assessment is due', '' from ins
union all select id, 6, 'Log inspection date and findings', '' from ins;

update public.compliance_items
set workflow_template_id = (select id from public.workflow_templates where name = 'Marae Structure Storm Readiness Check')
where id = '372fb428-3df8-40dd-8fab-2b856c6f3060';

with ins as (
  insert into public.workflow_templates (name, description, category)
  values ('Trustee Elections and Term Review', 'Election or term-renewal process for marae trustees, per charter requirements.', 'governance')
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description)
select id, 1, 'Confirm which trustee terms are expiring', '' from ins
union all select id, 2, 'Call for nominations per charter requirements', '' from ins
union all select id, 3, 'Verify nominee eligibility against charter', '' from ins
union all select id, 4, 'Conduct election or term-renewal vote', '' from ins
union all select id, 5, 'Record election results and new/renewed terms', '' from ins
union all select id, 6, 'Notify Maori Land Court of any changes, if required', '' from ins
union all select id, 7, 'Update trustee records and system access', '' from ins
union all select id, 8, 'Announce results to beneficiaries', '' from ins;

update public.compliance_items
set workflow_template_id = (select id from public.workflow_templates where name = 'Trustee Elections and Term Review')
where id = '89ce07e6-3b59-401c-b583-444a8d93f335';
