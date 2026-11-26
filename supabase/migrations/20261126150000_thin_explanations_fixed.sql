-- Replace placeholder / "partly confirmed" explanations with plain wording taken from the Framework (4.2, Area 6, drinking water, 2.1, gambling, alcohol, asbestos).
-- Nothing is added that the Framework does not already say. Items with no source say so. Safe to re-run.

update compliance_items set source_keys = array['CDEM02'], legal_basis_detail =
 'Good practice, not a legal requirement. The Civil Defence Emergency Management Act 2002 (s 17, read in full 22 Nov 2026) puts the planning duty on Civil Defence Groups and does not require a marae to hold an emergency plan. A plan lets the marae work with its local group. What to do: agree how you would reach whānau and the community if power and internet are down (for example a phone tree or a notice at the gate), write it down, and tell the committee.'
where name = 'Emergency communications plan — contact community if power/internet down';

update compliance_items set source_keys = array['CDEM02'], legal_basis_detail =
 'Good practice, not a legal requirement (Civil Defence Emergency Management Act 2002, s 17, read in full 22 Nov 2026: the planning duty sits with Civil Defence Groups, not the marae). An out-of-date contact list fails exactly when it is needed. What to do: list trustees, key community members and your Civil Defence coordinator with current phone numbers, and review the list regularly.'
where name = 'Emergency contact list — trustees, key community members, Civil Defence coordinator';

update compliance_items set source_keys = array['CDEM02'], legal_basis_detail =
 'Good practice, not a legal requirement (Civil Defence Emergency Management Act 2002, s 17, read in full 22 Nov 2026: the planning duty sits with Civil Defence Groups, not the marae). Supports the marae acting as a civil defence centre if it chooses to. What to do: check use-by dates and quantities, and replace what is out of date.'
where name = 'Emergency food and supply kit — stocked and checked';

update compliance_items set legal_basis_detail =
 'Good practice. No source available in MaraeHub for this item. A generator that has never been run may not start when needed. What to do: run it, check the fuel and have it serviced, and record the date.'
where name = 'Generator — tested, fuelled, serviced';

update compliance_items set legal_basis_detail =
 'A marae decision, not a legal requirement. How safety measures such as exits, extinguishers, signs and evacuation practice are applied in the wharenui and other tapu or restricted spaces is for kaumātua, beneficiaries and the marae governance authority to decide. MaraeHub records the decision and does not make it. The fire safety items still apply to the building where they apply. What to do: record who decided and what was agreed.'
where name = 'Marae decision recorded: how safety measures are applied in the wharenui and tapu spaces';

update compliance_items set source_keys = array['CDEM02'], legal_basis_detail =
 'A marae decision, not a legal requirement. The Civil Defence Emergency Management Act 2002 (s 17, read in full 22 Nov 2026) puts the planning duty on Civil Defence Groups and does not require a marae to act as an emergency hub. What to do: record whether the marae will open as a hub, when, and who decides.'
where name = 'Marae decision recorded: role as an emergency hub and who decides when it opens';

update compliance_items set legal_basis_detail =
 'Good practice. No source available in MaraeHub for this item. A backup that has never been restored may not work. What to do: keep a copy of the key trustee records (minutes, registers, the trust order or charter) somewhere other than the marae computer, and check that the copy opens.'
where name = 'Trustee records backed up and a restore tested';

update compliance_items set legal_basis_detail =
 'Good practice. Writing down where the marae''s drinking water comes from, who it is supplied to and how many people is the first step to knowing which water rules apply. Taumata Arowai says everyone who supplies drinking water to more than 25 people has a legal responsibility to ensure it is safe to drink (Taumata Arowai marae drinking water page, updated 28 May 2026). What to do: write down the source (council supply, tank, bore, roof or stream), who drinks it and roughly how many people.'
where name = 'Water assessment recorded: source, who is supplied, how many people';

update compliance_items set legal_basis_detail =
 'Good practice. It decides whether the marae is a business or undertaking under health and safety law. A marae with no employees is a volunteer association and has no duty under the Act (WorkSafe, Keeping volunteers healthy and safe, Sept 2024). What to do: record whether the marae or its trust pays anyone on an employment agreement, and the date. If you are unsure, for example because you use contractors, confirm with WorkSafe.'
where name = 'Recorded whether the marae employs anyone on an employment agreement';

update compliance_items set legal_basis_detail = replace(legal_basis_detail,
 'Partly confirmed; part of this is still being checked.',
 'What to do: find out whether any building was built before 2000. If one was, and the marae is a business or undertaking, have a competent person inspect it and write a management plan, and review the plan at least every five years. Before any refurbishment or demolition, a competent person must inspect.')
where name = 'Asbestos checked in any building built before 2000, with a management plan if it is present'
  and legal_basis_detail like '%Partly confirmed%';

update compliance_items set legal_basis_detail = replace(legal_basis_detail,
 'Partly confirmed; part of this is still being checked.',
 'What to do: work out which class the event is (prizes and turnover), check the marae can run it (class 2 and 3 need a society), pay no one for running it, and put the net proceeds to authorised purposes. If you are unsure, ask the Department of Internal Affairs.')
where name = 'Raffles and housie kept within the Department of Internal Affairs limits'
  and legal_basis_detail like '%Partly confirmed%';

update compliance_items set legal_basis_detail = replace(replace(legal_basis_detail,
 'Whether alcohol is allowed on the marae at all is a matter of tikanga and kawa, not law. Some parts (series of events, fees, Police reports) still rest on the Ministry page, which is archived and dated 2020. Partly confirmed; part of this is still being checked.',
 'Whether alcohol is allowed on the marae at all is for the marae to decide under its tikanga and kawa. The Ministry of Justice page is archived and dated 2020, so check fees and timing with your council. What to do: if alcohol will be sold, or an entry fee or koha is asked for, apply to the council at least 20 working days ahead.'), '  ', ' ')
where name = 'Special licence arranged for any event where alcohol is sold, or an entry fee or koha is charged'
  and legal_basis_detail like '%Partly confirmed%';
