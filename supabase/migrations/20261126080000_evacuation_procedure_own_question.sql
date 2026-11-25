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
  legal_basis_detail = 'A marae that employs people is a business or undertaking (PCBU) and has primary duties to keep workers and others safe (Health and Safety at Work Act 2015, s 36). A marae with no employees is a volunteer association and has no duty under the Act (WorkSafe, Sept 2024). What to do: confirm with WorkSafe what the duty means for your marae and record what you decide. Partly checked: the wording of s 36 is still to be re-read.'
where name = 'As an employer: duty to keep workers and others safe confirmed with WorkSafe'
  and legal_basis_detail not like '%What to do:%';
