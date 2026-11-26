-- The written evacuation procedure is its own test in the Framework (4.1 Test 1: Schedule 2, a building the public is
-- admitted to). It was filed under the "relevant building" question (Test 2), which is a different test.
-- Also gives three thin items real wording from the Framework (2.1, 1.x trusts). Guarded, safe to re-run.
update compliance_items set
  applicability_test = 'Is a building open to the public, such as a hall, wharekai or wharenui that people outside the whānau can use (Schedule 2 of the Fire Safety, Evacuation Procedures and Evacuation Schemes Regulations 2018)?',
  legal_basis_detail = 'Applies to a building the public is admitted to, with or without charge, including places of assembly such as halls (Fire and Emergency New Zealand (Fire Safety, Evacuation Procedures, and Evacuation Schemes) Regulations 2018, Schedule 2 and regs 5 to 17; Schedule 2 read 22 Nov 2026). It does not name marae. Whether a building used only by whānau counts as "public admitted" is still to be confirmed with Fire and Emergency New Zealand. What to do: if a building is open to the public, write down how people leave it in a fire and keep the procedure with the building records.'
where name = 'Written evacuation procedure for each building the public is admitted to'
  and applicability_test like 'Is the building a relevant building%';

update compliance_items set
  legal_basis_detail = 'The Trusts Act 2019 gives trustees five mandatory duties (ss 23 to 27), and the terms of the trust cannot change or remove them (s 22): know the terms of the trust; act in accordance with the terms; act honestly and in good faith; act for the benefit of the beneficiaries or to further a permitted purpose of the trust; exercise powers for a proper purpose. What to do: make sure every trustee has read the trust terms and these five duties, and record in the minutes that they have. Checked on the Act text (ss 22 to 27 read in full, version as at 28 October 2021). Whether the Act applies to a marae that is a Māori reservation is still being confirmed.'
where name = 'Trustees know the terms of the trust and their five mandatory duties'
  and legal_basis_detail not like '%Checked on the Act text%';

update compliance_items set
  legal_basis_detail = 'A marae that employs people is a business or undertaking (PCBU). Its main duty (Health and Safety at Work Act 2015, s 36) is to make sure, so far as is reasonably practicable, that its workers are safe at work and that other people are not put at risk by the work it does. That includes a work environment without risks, safe equipment and buildings, safe ways of working, proper welfare facilities for workers, the information, training and supervision needed, and monitoring workers'' health and the conditions at the workplace. A marae with no employees is a volunteer association and has no duty under the Act (WorkSafe, Sept 2024). What to do: confirm with WorkSafe what the duty means for your marae and record what you decide. Checked on the Act text (s 36 read in full, version as at 5 April 2025).'
where name = 'As an employer: duty to keep workers and others safe confirmed with WorkSafe'
  and legal_basis_detail not like '%Checked on the Act text%';

-- Part 1 (regs 5 to 7) applies to every Schedule 2 building, so exits and routes belong with the same "open to the public" question.
update compliance_items set
  applicability_test = 'Is a building open to the public, such as a hall, wharekai or wharenui that people outside the whānau can use (Schedule 2 of the Fire Safety, Evacuation Procedures and Evacuation Schemes Regulations 2018)?',
  legal_basis_detail = 'The owner and every tenant of a building the public is admitted to (including halls and other places of assembly) must keep the means of escape clear of obstacles and exit doors unlocked and free of blockages (Fire and Emergency New Zealand (Fire Safety, Evacuation Procedures, and Evacuation Schemes) Regulations 2018, reg 5; Schedule 2 and reg 5 read 26 Nov 2026). Flammable liquids must not be stored in or near the means of escape (reg 6). What to do: walk each exit route, check doors open from inside, nothing is stored in passages, and exit signs are clear. Whether a building used only by whānau counts as open to the public is still to be confirmed with Fire and Emergency New Zealand.'
where name = 'Emergency exits — checked clear, signed and operational'
  and applicability_test like 'Is the building a relevant building%';

update compliance_items set
  applicability_test = 'Is a building open to the public, such as a hall, wharekai or wharenui that people outside the whānau can use (Schedule 2 of the Fire Safety, Evacuation Procedures and Evacuation Schemes Regulations 2018)?',
  legal_basis_detail = 'The owner of a building the public is admitted to must make information about the evacuation procedure readily available to occupants, including the routes to the places of safety, how the fire alarm is signalled, firefighting equipment, help for anyone who needs it, and how to call Fire and Emergency New Zealand, and must put up clear signs summarising it (Fire and Emergency New Zealand (Fire Safety, Evacuation Procedures, and Evacuation Schemes) Regulations 2018, reg 7(3) and (4); read 26 Nov 2026). What to do: mark the routes, display the evacuation notice at each exit, and make sure the committee knows the routes. Whether a building used only by whānau counts as open to the public is still to be confirmed with Fire and Emergency New Zealand.'
where name = 'Evacuation routes — identified and communicated to committee'
  and applicability_test like 'Is the building a relevant building%';

-- Governance review: Charities Act 2005 s 42G (read in full 22 Nov 2026) makes the 3-yearly review a legal duty for a registered charity.
update compliance_items set
  framework_class = 'conditional_legal',
  legal_basis = 'Charities Act 2005, s 42G, if the marae is a registered charity',
  applicability_test = 'Is the marae on the Charities Register?',
  source_keys = array['CA05','CSGOV'],
  legal_basis_detail = 'Applies only if the marae is a registered charity. A registered charity must review its governance procedures at least every 3 years. The review must consider whether the procedures are fit for purpose, help the charity achieve its charitable purpose, and help it comply with the Charities Act (Charities Act 2005, s 42G). The review is self-directed and can be as simple as a trustee discussion; Charities Services gives a checklist. What to do: hold the review (a trustee discussion using the Charities Services checklist is enough), keep a note of it, and confirm the date in your annual return or update details. If the review changed your rules, send Charities Services a copy of the amended rules. Checked on the Act text (s 42G read in full, version as at 6 June 2026) and Charities Services guidance (updated September 2026).'
where name = 'Governance procedures reviewed in the last 3 years' and framework_class = 'good_practice';
