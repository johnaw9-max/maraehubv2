-- Gives the six items that had no question in the data their question, and adds "What to do:" to the eleven legal items that had none.
-- Wording comes from the Framework (1.1, 1.3, 2.1, 4.3, drinking water) and the sources already read. Safe to re-run.

update compliance_items set applicability_test = 'Is any new or altered electrical work done at the marae, now or in future?' where name = 'Certificates of Compliance kept for any new or altered electrical work' and applicability_test is null;
update compliance_items set applicability_test = 'Does the marae ever light a fire outdoors, such as a hāngī, bonfire or barbecue?' where name like 'Fire season checked before lighting any outdoor fire%' and applicability_test is null;
update compliance_items set applicability_test = 'Does the marae run raffles, housie or similar fundraisers?' where name = 'Raffles and housie kept within the Department of Internal Affairs limits' and applicability_test is null;
update compliance_items set applicability_test = 'Is alcohol ever sold or supplied at a marae event where there is an entry fee or koha?' where name like 'Special licence arranged for any event where alcohol%' and applicability_test is null;
update compliance_items set applicability_test = 'Is the marae land set apart as a Māori reservation under Te Ture Whenua Māori Act 1993, with trustees appointed by the Māori Land Court?' where name = 'Current list of trustees with appointment and term end dates' and applicability_test is null;
update compliance_items set applicability_test = 'Does the marae employ anyone on an employment agreement?' where name like 'Asbestos checked in any building built before 2000%' and applicability_test is null;

update compliance_items set legal_basis_detail =
 'If the marae employs anyone, it is a business or undertaking and its trustees act as officers. An officer of a business or undertaking that is not a company is a person in a position comparable with a company director (Health and Safety at Work Act 2015, s 18), and WorkSafe says that includes a board member, paid or voluntary. Officers must exercise due diligence. A volunteer officer has the same duty but commits no offence if they fall short (WorkSafe, Officers'' due diligence). A marae with no employees is a volunteer association, not a business or undertaking, so the duty does not arise. WorkSafe does not name marae trustees, so the step from board member to trustee is our reasoning. What to do: record whether the marae employs anyone. If it does, trustees note in the minutes that they act as officers and have read WorkSafe''s guidance on officers'' due diligence.'
where name = 'As an employer: trustees checked whether the officer due diligence duty applies';

update compliance_items set legal_basis_detail =
 'Where the marae is a business or undertaking (it employs people) and another business or undertaking has a duty for the same matter, each must, so far as is reasonably practicable, consult, co-operate with and co-ordinate activities with the other (Health and Safety at Work Act 2015, s 34, read in full). This applies only where the marae is itself a business or undertaking. What to do: if the marae employs people, list the contractors it uses and agree with each who does what on health and safety, and record it. If the marae has no employees and uses contractors, confirm with WorkSafe what applies.'
where name = 'Contractor Health & Safety Management Review';

update compliance_items set legal_basis_detail =
 'Where the marae is a business or undertaking (it employs people), first aid equipment must be adequate, each worker must be able to reach it, and enough people must be trained in first aid (Health and Safety at Work (General Risk and Workplace Management) Regulations 2016, reg 13). A volunteer-only marae is not a business or undertaking (Health and Safety at Work Act 2015, s 17), so for it a stocked first aid kit is good practice. What to do: check the first aid kit is stocked and in date and that everyone knows where it is. If the marae employs people, also make sure enough people are trained in first aid.'
where name = 'First aid kit — stocked and in date';

update compliance_items set source_keys = array['HSWA15','WSVOL'], legal_basis_detail =
 'A marae with employees is a business or undertaking with legal duties under the Health and Safety at Work Act 2015. A marae with no employees is a volunteer association and has no duty under the Act (s 17; WorkSafe, Keeping volunteers healthy and safe, Sept 2024), but a written health and safety policy is good practice. What to do: review the policy, or write one if there is none, and record the date. If you are unsure whether the duties apply, confirm with WorkSafe.'
where name = 'Health & Safety Policy Review';

update compliance_items set legal_basis_detail =
 'Regulation 4 requires trustees of a Māori reservation to publish notice of their appointment in a local newspaper within 7 days. Regulation 6 requires them to act in good faith and administer the reservation to benefit those entitled to use it (Māori Reservations Regulations 1994, version as at 9 January 2025, read in full 22 Nov 2026). What to do: keep a list of every trustee with the date appointed and the term end date, and for each appointment check that notice was published within 7 days. Induction for new trustees is good practice.'
where name = 'Current list of trustees with appointment and term end dates';

update compliance_items set legal_basis_detail = legal_basis_detail ||
 ' What to do: find the charter drawn up with the beneficiaries and note where the signed copy is kept. If there is no charter, the trustees need to draw one up with the beneficiaries.'
where name like 'Marae charter — written with beneficiaries%' and legal_basis_detail not like '%What to do:%';

update compliance_items set legal_basis_detail =
 'New electrical installation work must be tested and certified. From 13 November 2026 electrical workers must use AS/NZS 3000:2018 and every Certificate of Compliance must name that version. A Certificate of Verification is needed if an installation has been disconnected for more than six months (WorkSafe, read in full 26 Nov 2026). What to do: after any new or altered electrical work, ask the electrician for the Certificate of Compliance, check it names AS/NZS 3000:2018, and keep it with the building records.'
where name = 'Certificates of Compliance kept for any new or altered electrical work';

update compliance_items set legal_basis_detail =
 'Testing and monitoring requirements depend on your supply''s classification, and MaraeHub cannot work them out for you. What to do: confirm the testing frequency and what is tested with Taumata Arowai or your drinking water safety plan, then record each result and date here.'
where name like 'Drinking water testing and monitoring%';

update compliance_items set legal_basis_detail =
 'Lighting a fire in the open air is not allowed in a prohibited fire season, and in a restricted season it needs a permit unless the fire type is authorised. A hāngī is an authorised fire type in both seasons if the fire area is under 4 square metres, at least 5 metres from any building or anything that could burn, a way to put it out is within 5 metres, it is never left unattended, and it is put out once the stones reach cooking temperature, before cooking starts (Fire and Emergency New Zealand pages, read in full 26 Nov 2026). What to do: before lighting any fire outdoors, check the fire season for your area. In a prohibited season do not light it. In a restricted season get a permit unless it is an authorised type that meets the conditions above.'
where name like 'Fire season checked before lighting any outdoor fire%';

update compliance_items set legal_basis_detail = legal_basis_detail ||
 ' What to do: work out where your drinking water comes from and who it serves, then confirm with Taumata Arowai whether the supply must be registered.'
where name like 'Water supply classification and registration%' and legal_basis_detail not like '%What to do:%';

update compliance_items set legal_basis_detail =
 'If your marae uses treatment equipment (UV, chlorination, filtration), it must be maintained to keep water safe to drink. Servicing frequency depends on the equipment and the manufacturer''s guidance, not a single fixed legal interval. What to do: find the service schedule for your equipment, have it serviced on that schedule, and record each date here.'
where name like 'Water treatment system — serviced and confirmed working%';
