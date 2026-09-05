-- Post #15 (Water Scarcity/Drought Preparedness). Standalone,
-- staged-response workflow -- unlike Flood, drought is slow-onset with a
-- genuinely real sequential response (monitor, conserve, confirm carrier
-- registration, follow restrictions, protect the reserve, restock after),
-- so it fits the same "orderly, sequential response" pattern
-- HelpMenu.js already documents for Water Contamination Response, not
-- Flood's "fast-moving and chaotic, no workflow" pattern. Not linked to
-- any compliance_items row -- deliberately no new Compliance category for
-- this (no real, recurring regulatory obligation behind drought
-- preparedness the way water safety testing has one). Steps grounded
-- directly in the real hazard content seeded alongside this
-- (20260904030000_drought_water_shortage_hazard.sql).

with new_template as (
  insert into public.workflow_templates (name, description, category)
  select
    'Drought / Water Shortage Response',
    'Staged response to a developing water shortage -- monitor conditions, cut non-essential use early, protect your emergency reserve, and follow real restrictions as conditions worsen.',
    'compliance'
  where not exists (
    select 1 from public.workflow_templates where name = 'Drought / Water Shortage Response'
  )
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description, requires_document, document_label)
select new_template.id, s.step_order, s.title, s.description, s.requires_document, s.document_label
from new_template
cross join (values
  (1, 'Check real drought status for your district',        'Check your regional council''s advisories and the real NZ Drought Index (NIWA/MPI) for your district.', false, null),
  (2, 'Confirm your real supply capacity',                    'Confirm your tank size or bore capacity and how many days of normal use it represents at current levels.', false, null),
  (3, 'Cut non-essential use early',                          'Reduce non-essential use (gardens, washing vehicles, topping up pools) as soon as dry conditions are forecast -- before restrictions become mandatory.', false, null),
  (4, 'Confirm your water carrier is registered',             'If you may need a trucked water carrier, confirm the provider is on Taumata Arowai''s real Public Register of Drinking Water Supplies (Hinekorako) before booking.', false, null),
  (5, 'Follow supplier or council restrictions exactly',      'Follow every restriction your water supplier or council issues exactly as instructed, for as long as it is in place.', false, null),
  (6, 'Protect the emergency reserve',                        'Keep the Civil Defence emergency minimum (at least 3 litres per person per day, for 3 or more days) genuinely separate from everyday use -- do not draw it down for routine needs.', false, null),
  (7, 'Treat any untreated water before drinking',            'If only untreated rainwater, bore or stream water remains, boil it before drinking, cooking or brushing teeth -- it is fine for laundry, cleaning or toilet flushing untreated.', false, null),
  (8, 'Log the event and any real costs',                     'Record what happened, the restrictions followed, and any real costs incurred in the Incident Register.', false, null),
  (9, 'Restock and review before next season',                'Restock the emergency reserve, and review tank/bore capacity for next season. Contact your local Rural Support Trust if this was part of a wider declared drought event.', false, null)
) as s(step_order, title, description, requires_document, document_label)
where new_template.id is not null;
