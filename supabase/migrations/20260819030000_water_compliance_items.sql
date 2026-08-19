-- Stage 3 of the Water Safety Readiness work (ClickUp 86d42u3pp). Seeds 3
-- real compliance items under the new 'water' category, matching the
-- shape of the 5 fire safety items (due_date/responsible_name/entity_id
-- left null -- nothing checked yet, no fabricated owner).
--
-- First real use of legal_basis/legal_basis_detail anywhere in this
-- table -- confirmed via direct query that all 15 existing rows,
-- including the 5 fire items, have both null (deferred and never
-- completed by the 15 Aug migration that added the columns). Fire's
-- fields are left as-is, a separate tracked gap, not touched here.
--
-- Each legal_basis_detail explicitly defers the real, specific
-- obligation to Taumata Arowai -- MaraeHub records dates and evidence,
-- it does not determine compliance.

insert into public.compliance_items (category, name, renewal_months, classification, legal_basis, legal_basis_detail) values
  (
    'water',
    'Drinking water testing and monitoring — confirmed against your supply''s requirements',
    6,
    'task',
    'Water Services Act 2021 — Taumata Arowai Drinking Water Quality Assurance Rules',
    'Testing and monitoring requirements depend on your supply''s real classification (e.g. self-supply, community, or registered supply) and cannot be determined by MaraeHub. Confirm your actual required testing frequency and parameters directly with Taumata Arowai or your drinking water safety plan, and record results and dates here.'
  ),
  (
    'water',
    'Water treatment system — serviced and confirmed working (if applicable)',
    12,
    'task',
    'Water Services Act 2021 — Taumata Arowai Drinking Water Quality Assurance Rules',
    'If your marae uses treatment equipment (UV, chlorination, filtration), it must be maintained to keep water safe to drink. Servicing frequency depends on the equipment and manufacturer guidance, not a single fixed legal interval — confirm the real schedule for your system and record completion here. Not applicable if your supply has no treatment system.'
  ),
  (
    'water',
    'Water supply classification and registration — confirmed with Taumata Arowai',
    12,
    'task',
    'Water Services Act 2021 — Taumata Arowai',
    'Most marae water supplies are classified as non-residential or community supplies, not exempt domestic self-supplies, and may need to register and meet real legal obligations even for small or occasional-use systems. The exact classification and obligations depend on your specific supply and cannot be determined by MaraeHub — confirm directly with Taumata Arowai and record the outcome here.'
  );
