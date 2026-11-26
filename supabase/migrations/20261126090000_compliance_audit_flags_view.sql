-- Checks the data for the mistakes found on 26 Nov 2026. It cannot tell whether a class is right; that needs the Framework section and the source.
create or replace view compliance_audit_flags as
select id, name, 'legal item has no question to decide if it applies' as flag
  from compliance_items where framework_class = 'conditional_legal' and coalesce(applicability_test, '') = ''
union all
select id, name, 'legal item has no source recorded'
  from compliance_items where framework_class = 'conditional_legal' and coalesce(array_length(source_keys, 1), 0) = 0
union all
select id, name, 'explanation is a placeholder or says it was only read via a summary'
  from compliance_items
  where legal_basis_detail ilike '%Partly confirmed; part of this is still being checked%'
     or legal_basis_detail ilike '%read via a summary%'
     or coalesce(length(legal_basis_detail), 0) < 120
union all
select id, name, 'legal item has no "What to do:" line in its explanation'
  from compliance_items where framework_class = 'conditional_legal' and coalesce(legal_basis_detail, '') not ilike '%What to do:%'
union all
select ci.id, ci.name, 'source not fully verified: ' || ls.key
  from compliance_items ci
  join legal_sources ls on ls.key = any(ci.source_keys)
  where ci.framework_class = 'conditional_legal' and ls.status not ilike 'Verified%';
