-- Stage 2 of Fire Safety Readiness -- creates 5 real fire safety
-- compliance items on Opeke, matching the 5 checks named in the
-- planned Facebook post (extinguishers, alarms, exits, evacuation
-- procedures, warden arrangements). Cadences grounded in the real
-- Fire and Emergency NZ marae evacuation scheme exemplar (6-monthly
-- trial evacuation + warden refresher requirement) and Tineka's own
-- existing "Fire Extinguisher Service" precedent (12-monthly).
--
-- due_date and responsible_name deliberately left NULL -- nothing has
-- actually been checked yet, so no real date/owner exists to record;
-- matches the pattern of other never-yet-assessed items rather than
-- fabricating either. entity_id left NULL, matching all 10 existing
-- real Opeke compliance_items (confirmed RLS-visible with NULL).
--
-- Only Evacuation Scheme Review is classified workflow, linked to the
-- existing, already-comprehensive "Fire Safety Compliance Check"
-- template (id ebe303f6-a1be-4950-a722-b8a9dc91e101) -- its content is
-- genuinely a scheme review + drill process. The other 4 stay task,
-- matching Tineka's Fire Extinguisher Service precedent of not every
-- simple check needing its own workflow.

insert into public.compliance_items (category, name, renewal_months, classification, workflow_template_id) values
  ('emergency_preparedness', 'Fire extinguishers — inspected and serviced', 12, 'task', null),
  ('emergency_preparedness', 'Fire alarms — tested and detection confirmed working', 6, 'task', null),
  ('emergency_preparedness', 'Emergency exits — checked clear, signed and operational', 6, 'task', null),
  ('emergency_preparedness', 'Evacuation scheme — reviewed and trial evacuation completed', 6, 'workflow', 'ebe303f6-a1be-4950-a722-b8a9dc91e101'),
  ('emergency_preparedness', 'Fire warden arrangements — trained and refreshed', 6, 'task', null);
