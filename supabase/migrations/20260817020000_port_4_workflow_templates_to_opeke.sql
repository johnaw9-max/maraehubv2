-- Ports the 4 workflow_templates built in Stage 3 (86d41epk8, commit
-- 0604610) that never reached Opeke, since that whole change set was
-- blocked by 86d41hgzx. Content copied exactly from live Tineka --
-- same IDs reused (safe: separate databases, no cross-references),
-- same title/description text verbatim including the real empty-string
-- step descriptions. Then reclassifies the 4 matching real Opeke
-- compliance_items to workflow, linked to their real templates, same
-- logic already applied to the 5th (Civil Defence Emergency Plan,
-- 20260817010000).

insert into public.workflow_templates (id, name, description, category, is_active) values
  ('5d022e77-cc05-4f77-9c86-3da0d04011a9', 'Evacuation Routes Review', 'Annual review and communication of marae evacuation routes, including accessibility routes.', 'compliance', true),
  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 'Generator Test and Service', 'Monthly load test, fuel check, and service log for the marae backup generator.', 'compliance', true),
  ('9a2ac685-edd7-4c3e-922f-89b53c1c5fb2', 'Marae Structure Storm Readiness Check', 'Six-monthly visual inspection of the marae structure for storm readiness.', 'compliance', true),
  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 'Water Tank Inspection', 'Six-monthly inspection of the emergency water supply tank for leaks, contamination, and pump operation.', 'compliance', true);

insert into public.workflow_steps (template_id, step_order, title, description) values
  ('5d022e77-cc05-4f77-9c86-3da0d04011a9', 1, 'Review and update evacuation route maps', ''),
  ('5d022e77-cc05-4f77-9c86-3da0d04011a9', 2, 'Confirm accessibility routes are included', 'For those with mobility needs'),
  ('5d022e77-cc05-4f77-9c86-3da0d04011a9', 3, 'Print and post maps at key locations in the marae', ''),
  ('5d022e77-cc05-4f77-9c86-3da0d04011a9', 4, 'Brief all trustees on evacuation routes', ''),
  ('5d022e77-cc05-4f77-9c86-3da0d04011a9', 5, 'Brief key volunteers on evacuation routes', ''),
  ('5d022e77-cc05-4f77-9c86-3da0d04011a9', 6, 'Log briefing date and attendees', ''),

  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 1, 'Start generator and run under load', 'Run for at least 15 minutes under load'),
  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 2, 'Check fuel level and top up', ''),
  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 3, 'Add fuel stabiliser if stored long-term', 'Needed if fuel has been sitting more than 3 months'),
  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 4, 'Inspect for oil leaks, wear, or damage', ''),
  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 5, 'Check battery and starter condition', ''),
  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 6, 'Log test date, run time, and any issues found', ''),
  ('2d5e8dee-6327-48f6-93a5-6383acaecb69', 7, 'Schedule next test date', ''),

  ('9a2ac685-edd7-4c3e-922f-89b53c1c5fb2', 1, 'Visually inspect roof for damage or wear', ''),
  ('9a2ac685-edd7-4c3e-922f-89b53c1c5fb2', 2, 'Visually inspect exterior walls and foundations', ''),
  ('9a2ac685-edd7-4c3e-922f-89b53c1c5fb2', 3, 'Check drainage and guttering are clear', ''),
  ('9a2ac685-edd7-4c3e-922f-89b53c1c5fb2', 4, 'Note any issues requiring urgent repair', ''),
  ('9a2ac685-edd7-4c3e-922f-89b53c1c5fb2', 5, 'Confirm whether the annual qualified-builder structural assessment is due', ''),
  ('9a2ac685-edd7-4c3e-922f-89b53c1c5fb2', 6, 'Log inspection date and findings', ''),

  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 1, 'Inspect tank exterior and fittings for leaks', ''),
  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 2, 'Check water level and top up if needed', ''),
  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 3, 'Inspect for visible contamination', 'Debris, algae, discolouration'),
  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 4, 'Test pump operation and pressure', ''),
  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 5, 'Confirm potability', 'Test or visual/smell check per local guidance'),
  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 6, 'Clean tank inlet or filter if required', ''),
  ('2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4', 7, 'Log inspection date and findings', '');

update public.compliance_items set classification = 'workflow', workflow_template_id = '5d022e77-cc05-4f77-9c86-3da0d04011a9'
  where id = '8ddd37e9-63ef-4c0e-af71-1ee0282f812f'; -- "Evacuation routes — identified and communicated to committee"
update public.compliance_items set classification = 'workflow', workflow_template_id = '2d5e8dee-6327-48f6-93a5-6383acaecb69'
  where id = '50d77b42-fe31-4785-a3c8-e344092dec85'; -- "Generator — tested, fuelled, serviced"
update public.compliance_items set classification = 'workflow', workflow_template_id = '9a2ac685-edd7-4c3e-922f-89b53c1c5fb2'
  where id = 'ad3b18e2-f08d-4868-bc7b-df8f2b5c4553'; -- "Marae structure — roof, walls, foundations checked for storm readiness"
update public.compliance_items set classification = 'workflow', workflow_template_id = '2c1cd3da-f26d-4e1d-88bf-a4cd355c9ad4'
  where id = '65a0d719-503e-41b7-b9d3-5258ec4f0ee8'; -- "Water supply — 10,000L tank or alternative checked"
