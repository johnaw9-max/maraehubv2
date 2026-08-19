-- Stage 4 of the Water Safety Readiness work (ClickUp 86d42u3pp, optional).
-- Standalone incident-response workflow template, not linked to any
-- compliance_items row -- unlike Fire's evacuation-scheme item, water
-- contamination response is incident-triggered, not a recurring
-- scheduled review, so there's no natural compliance_items row to
-- attach it to. Started manually from Workflows when needed. Steps
-- grounded directly in the real Water Contamination hazard content
-- seeded in Stage 2 (source: Taumata Arowai, fetched 19 Aug 2026).

with new_template as (
  insert into public.workflow_templates (name, description, category)
  select
    'Water Contamination Response',
    'Incident response for a suspected or confirmed unsafe drinking water supply -- stop use, notify the right people, retest, and confirm safe before resuming.',
    'compliance'
  where not exists (
    select 1 from public.workflow_templates where name = 'Water Contamination Response'
  )
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description, requires_document, document_label)
select new_template.id, s.step_order, s.title, s.description, s.requires_document, s.document_label
from new_template
cross join (values
  (1,  'Stop use and warn people on site',        'Stop drinking the water immediately and tell everyone on site not to use it for drinking, cooking or brushing teeth.', false, null),
  (2,  'Provide alternative water',                'Provide bottled or boiled water for drinking, cooking and brushing teeth until the supply is confirmed safe.', false, null),
  (3,  'Assess the likely cause',                  'Check for a likely cause -- source contamination, a treatment or filtration fault, a pump or tank issue, or a burst or compromised pipe.', false, null),
  (4,  'Notify Taumata Arowai',                     'Notify Taumata Arowai as soon as possible. For an imminent risk of serious illness or death, call their 24/7 hotline on 0800 454 717 outside normal business hours (Mon-Fri, 8am-5pm); otherwise use their standard notify-us process.', false, null),
  (5,  'Notify Public Health if advised',           'If advised by Taumata Arowai, or if a suspected illness is involved, notify your local Public Health service.', false, null),
  (6,  'Arrange retesting',                         'Book a real water test with a recognised testing provider before considering the supply safe to use again.', true, 'Upload test booking confirmation'),
  (7,  'Repair or service the cause',               'Address the identified cause -- repair, replace or service the affected equipment (tank, pump, filter, treatment system) before resuming use.', false, null),
  (8,  'Confirm results before resuming use',       'Do not resume normal use until real test results confirm the water is safe.', true, 'Upload test results'),
  (9,  'Log the incident',                          'Record what happened, who was told, and the actions taken in the Incident Register.', false, null),
  (10, 'Update compliance record and close',        'Mark the relevant water compliance item as reviewed, update next testing or servicing dates, and file all documents.', false, null)
) as s(step_order, title, description, requires_document, document_label)
where new_template.id is not null;
