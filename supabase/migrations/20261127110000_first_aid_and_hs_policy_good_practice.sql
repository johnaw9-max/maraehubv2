-- Framework Draft v0.4, Area 2.1 (first aid and contractors, read 26 Nov 2026): reg 13 (first aid) applies to a PCBU,
-- and a marae with no employees is not a PCBU, "where a stocked first aid kit is good practice". So a first aid kit
-- applies to every marae: legal duty if it employs people, good practice if it does not. Same for the health and
-- safety policy (WorkSafe: a written policy is good practice for a volunteer-only marae).
-- Before, both were tied to "do you employ anyone?", so answering "no" removed them. They now always apply.
update public.compliance_items
set framework_class = 'good_practice',
    framework_class_note = 'Legal duty if the marae employs anyone (reg 13). Good practice for every marae.',
    applicability_test = null,
    applies = 'yes'
where name in ('First aid kit — stocked and in date', 'Health & Safety Policy Review');

-- Put back the two that were switched off only because the marae has no employees.
update public.compliance_items
set not_applicable_reason = null, not_applicable_by = null, not_applicable_at = null
where name in ('First aid kit — stocked and in date', 'Health & Safety Policy Review')
  and not_applicable_at is not null
  and (not_applicable_reason ilike '%paid%' or not_applicable_reason ilike '%employ%' or not_applicable_reason ilike 'not required%');
