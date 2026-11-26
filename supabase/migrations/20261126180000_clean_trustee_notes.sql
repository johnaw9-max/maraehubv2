-- The "notes" line under each item is read by trustees. It carried Framework codes and "Verification: Partly verified / To verify" text.
-- Those are working notes, so they are removed; what a trustee needs (when it applies, how often, evidence) stays. Safe to re-run.

update compliance_items set notes = regexp_replace(notes, '^Framework v0\.4[^·]*· ', '') where notes like 'Framework v0.4%';
update compliance_items set notes = regexp_replace(notes, ' · Verification: [^·]*', '', 'g') where notes like '%Verification:%';
update compliance_items set notes = replace(notes, 'Frequency: Every 3 years (expectation, not confirmed as a legal duty).', 'Frequency: Every 3 years.') where notes like '%expectation, not confirmed%';

update compliance_items set notes = 'Test it under load. Fuel stabiliser if stored long-term. Log every test run.' where name = 'Generator — tested, fuelled, serviced';
update compliance_items set notes = 'Visual inspection after major weather events. Ask a qualified builder to assess anything you are unsure about.' where name like 'Marae structure — roof, walls, foundations%';
update compliance_items set notes = 'Check expiry dates on food and medications.' where name = 'Emergency food and supply kit — stocked and checked';

update compliance_items set legal_basis = 'Good practice' where name like 'Community welfare register%' and legal_basis like '%Privacy Act%';
update compliance_items set legal_basis = 'Good practice' where name in ('Building & Contents Insurance', 'Public Liability Insurance') and legal_basis like '%no law requires it%';

update compliance_items set legal_basis_detail = 'No law requires a marae to hold an emergency plan, but a current plan lets the marae work with the local Civil Defence group, which plans under the Civil Defence Emergency Management Act 2002 (s 17, read in full 22 Nov 2026). What to do: review the plan, update the contacts in it, and record the date.'
 where name = 'Civil Defence Emergency Plan — reviewed and up to date';
update compliance_items set legal_basis_detail = 'Good practice, not a legal requirement. Helps the marae look after whānau who need checking on in an emergency. No source available in MaraeHub for this item. What to do: keep the list limited, get each person''s consent, store it securely, and review it regularly.'
 where name like 'Community welfare register%';
update compliance_items set legal_basis_detail = 'Good practice, not a legal requirement. Babies, older people, people with health conditions and people living alone are most at risk in the heat (Health NZ). What to do: write the plan down: drinking water and shade for manuhiri, a cool space, and checks on kaumātua and others at risk.'
 where name like 'Hot weather plan for hui%';
update compliance_items set legal_basis_detail = 'Good practice, not a legal requirement. A hirer who organises an event is likely to be a business or undertaking and cannot hand its safety duties to someone else. The marae sets its own rules for hirers: building limits, the evacuation scheme, and who does what. What to do: check your hire agreement says who is responsible for safety at hired events, and have hirers sign it.'
 where name = 'Hire agreement says who is responsible for safety at hired events';

create or replace view compliance_audit_flags as
 select id, name, 'legal item has no question to decide if it applies'::text as flag from compliance_items
  where framework_class = 'conditional_legal' and coalesce(applicability_test, '') = ''
 union all select id, name, 'legal item has no source recorded' from compliance_items
  where framework_class = 'conditional_legal' and coalesce(array_length(source_keys, 1), 0) = 0
 union all select id, name, 'explanation is a placeholder or says it was only read via a summary' from compliance_items
  where legal_basis_detail ilike '%Partly confirmed; part of this is still being checked%' or legal_basis_detail ilike '%read via a summary%' or coalesce(length(legal_basis_detail), 0) < 120
 union all select id, name, 'text shown to trustees has an internal working note (I, my, to verify, not yet verified, Framework code)' from compliance_items
  where concat_ws(' ', legal_basis_detail, notes, legal_basis) ~ '(^|[^A-Za-z])(I|I''ve|my|me)([^A-Za-z]|$)'
     or concat_ws(' ', legal_basis_detail, notes, legal_basis) ~* 'TBD|to verify|not yet verified|partly (checked|confirmed|verified)|still being checked|has not (yet )?been (checked|verified)|Verification:|Framework v0|\[[A-Z]{1,3}[0-9]+\]|not confirmed'
 union all select id, name, 'item has no "What to do:" line in its explanation' from compliance_items
  where coalesce(legal_basis_detail, '') !~* 'What to do:'
 union all select id, name, 'item has no source and does not say so' from compliance_items
  where framework_class in ('conditional_legal', 'good_practice') and coalesce(array_length(source_keys, 1), 0) = 0 and coalesce(legal_basis_detail, '') !~* 'No source available'
 union all select ci.id, ci.name, 'source not fully verified: ' || ls.key from compliance_items ci
  join legal_sources ls on ls.key = any (ci.source_keys)
  where ci.framework_class = 'conditional_legal' and ls.status not ilike 'Verified%';

-- Trustees see "Marae Governance and Compliance Framework", not a draft version code.
update compliance_items set legal_basis = replace(legal_basis, 'Framework v0.4', 'Marae Governance and Compliance Framework') where legal_basis like '%Framework v0.4%';
