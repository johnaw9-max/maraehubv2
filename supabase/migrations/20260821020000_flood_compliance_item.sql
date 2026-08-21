-- Stage 2 of the Flood/Emergency Preparedness Readiness work (ClickUp
-- 86d43pxzb). Seeds 1 real compliance item under the existing
-- 'emergency_preparedness' category -- no new category needed, unlike
-- water. due_date/responsible_name/entity_id left null, matching the
-- established pattern from the water compliance items migration
-- (20260819030000): nothing checked yet, no fabricated owner.
--
-- Only the second real use of legal_basis/legal_basis_detail in this
-- table -- the water items (20260819030000) were the first. Grounded in
-- a real, dated regulation confirmed via direct search, not assumed from
-- the fire/water pattern: the Local Government (Natural Hazard
-- Information in Land Information Memoranda) Regulations 2025, in force
-- 17 October 2025.
--
-- Building Act 2004 ss71-72 is also real but doesn't fit a recurring
-- compliance item -- it only triggers at the point of a new building
-- consent, not an ongoing renewal -- so it's noted as context in `notes`
-- rather than fabricated into its own item.

insert into public.compliance_items (category, name, renewal_months, classification, legal_basis, legal_basis_detail, notes) values
  (
    'emergency_preparedness',
    'LIM report reviewed for known flood-hazard information',
    24,
    'task',
    'Local Government (Natural Hazard Information in Land Information Memoranda) Regulations 2025 (SL 2025/68)',
    'Since 17 October 2025, councils must include known flood-hazard information in LIM reports in a standardised flood-risk-rating format. The absence of flood information on a LIM does not mean the property will not flood -- it means no flood hazard has been identified in the council''s current datasets for that location. Request a current LIM from your local council and record what it shows here.',
    'If planning any new building work or major alterations, Building Act 2004 ss71-72 may also apply -- a council must refuse consent on land subject to a natural hazard unless specific conditions are met, and any consent granted under s72 must be noted on the property title.'
  );
