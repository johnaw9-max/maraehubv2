-- Good-practice items with no source now say so, and every item has a "What to do:" line.
-- Fire extinguishers: first-person note replaced; rests on building.govt.nz (BGBWOF). Audit view widened. Safe to re-run.

update compliance_items set source_keys = array['BGBWOF'], legal_basis_detail =
 'Good practice, not a legal requirement. Working extinguishers protect people and the building. Hand-held extinguishers are not on the list of specified systems for a building warrant of fitness (building.govt.nz, page updated 26 Nov 2024, read 22 Nov 2026). What to do: have each extinguisher inspected and serviced, and record the date. If you are unsure what your building needs, ask your insurer or Fire and Emergency New Zealand.'
where name = 'Fire extinguishers — inspected and serviced';

update compliance_items set legal_basis_detail = legal_basis_detail || ' No source available in MaraeHub for this item. What to do: check the policy is current and still matches your buildings and contents, and record the renewal date.' where name = 'Building & Contents Insurance' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' No source available in MaraeHub for this item. What to do: check the policy is current and covers your events, and record the renewal date.' where name = 'Public Liability Insurance' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' What to do: review the plan, update the contacts in it, and record the date.' where name = 'Civil Defence Emergency Plan — reviewed and up to date' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' No source available in MaraeHub for this item. What to do: keep the list limited, get each person''s consent, store it securely, and review it regularly.' where name like 'Community welfare register%' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' What to do: check your hire agreement says who is responsible for safety at hired events, and have hirers sign it.' where name = 'Hire agreement says who is responsible for safety at hired events' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' What to do: write the plan down: drinking water and shade for manuhiri, a cool space, and checks on kaumātua and others at risk.' where name like 'Hot weather plan for hui%' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' What to do: get a current LIM report from your council and note any flood-hazard information in it.' where name = 'LIM report reviewed for known flood-hazard information' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' No source available in MaraeHub for this item. What to do: walk the roof, walls and foundations, note any damage, and arrange repairs.' where name like 'Marae structure — roof, walls, foundations%' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' What to do: agree the plan and record it in the minutes.' where name = 'Succession plan for trustees and key volunteers agreed' and legal_basis_detail !~* 'What to do:';
update compliance_items set legal_basis_detail = legal_basis_detail || ' No source available in MaraeHub for the 10,000L figure. What to do: check the emergency water tank or alternative holds enough water for the people who would stay, and record the date.' where name like 'Water supply — 10,000L tank%' and legal_basis_detail !~* 'What to do:';

create or replace view compliance_audit_flags as
 select id, name, 'legal item has no question to decide if it applies'::text as flag from compliance_items
  where framework_class = 'conditional_legal' and coalesce(applicability_test, '') = ''
 union all select id, name, 'legal item has no source recorded' from compliance_items
  where framework_class = 'conditional_legal' and coalesce(array_length(source_keys, 1), 0) = 0
 union all select id, name, 'explanation is a placeholder or says it was only read via a summary' from compliance_items
  where legal_basis_detail ilike '%Partly confirmed; part of this is still being checked%' or legal_basis_detail ilike '%read via a summary%' or coalesce(length(legal_basis_detail), 0) < 120
 union all select id, name, 'explanation has an internal working note (I, my, to verify, not yet verified)' from compliance_items
  where legal_basis_detail ~ '(^|[^A-Za-z])(I|I''ve|my|me)([^A-Za-z]|$)' or legal_basis_detail ~* 'TBD|to verify|not yet verified|partly (checked|confirmed)|still being checked|has not (yet )?been (checked|verified)'
 union all select id, name, 'item has no "What to do:" line in its explanation' from compliance_items
  where coalesce(legal_basis_detail, '') !~* 'What to do:'
 union all select id, name, 'item has no source and does not say so' from compliance_items
  where framework_class in ('conditional_legal', 'good_practice') and coalesce(array_length(source_keys, 1), 0) = 0 and coalesce(legal_basis_detail, '') !~* 'No source available'
 union all select ci.id, ci.name, 'source not fully verified: ' || ls.key from compliance_items ci
  join legal_sources ls on ls.key = any (ci.source_keys)
  where ci.framework_class = 'conditional_legal' and ls.status not ilike 'Verified%';
