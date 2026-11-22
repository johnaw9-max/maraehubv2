-- Source keys on each compliance item: which register sources (public.legal_sources) back the item.
-- Source of truth is the Framework, Appendix C.2; MaraeHub copies it. Additive: one new column, no existing wording or date changes.
-- Only items whose own legal basis clearly names the source are set. Items with no clear source (good practice, tikanga, not yet researched) stay empty.
-- Re-running changes nothing: a row that already has keys is left alone.
alter table public.compliance_items add column if not exists source_keys text[] not null default '{}';

update public.compliance_items i
set source_keys = v.keys
from (values
  ($q$Building Warrant of Fitness$q$, array['BA04', 'BGBWOF']),
  ($q$Fire alarms — tested and detection confirmed working$q$, array['BA04', 'BGBWOF']),
  ($q$LIM report reviewed for known flood-hazard information$q$, array['LIM25']),
  ($q$Written evacuation procedure for each building the public is admitted to$q$, array['FENZR18', 'FENZES']),
  ($q$Evacuation scheme — reviewed and trial evacuation completed$q$, array['FENZ17', 'FENZR18', 'FENZES']),
  ($q$Civil Defence Emergency Plan — reviewed and up to date$q$, array['CDEM02']),
  ($q$As an employer: duty to keep workers and others safe confirmed with WorkSafe$q$, array['HSWA15']),
  ($q$As an employer: trustees checked whether the officer due diligence duty applies$q$, array['HSWA15', 'WSOFF']),
  ($q$Health & Safety Policy Review$q$, array['HSWA15']),
  ($q$Recorded whether the marae employs anyone on an employment agreement$q$, array['WSVOL']),
  ($q$Volunteer safety induction done; incident and near-miss register kept$q$, array['WSVOL']),
  ($q$Charities annual return and performance report filed within 6 months of balance date$q$, array['CA05', 'CSOBL']),
  ($q$Governance procedures reviewed in the last 3 years$q$, array['CSGOV']),
  ($q$Accurate, separate, up-to-date records of the reservation's administration kept$q$, array['MRR94']),
  ($q$Annual meeting held with at least 21 days' notice, open to beneficiaries$q$, array['MRR94']),
  ($q$First trustee meeting within 30 days of appointment; minute book kept$q$, array['MRR94']),
  ($q$Marae charter — written with beneficiaries; signed copy located (good practice)$q$, array['MRR94']),
  ($q$Notice of each trustee appointment published in a local newspaper within 7 days$q$, array['MRR94']),
  ($q$Reservation money in a separate bank account with at least two authorised signatories$q$, array['MRR94']),
  ($q$Trustees know their duty to act in good faith and run the reservation for its purposes$q$, array['MRR94']),
  ($q$Trustees know the terms of the trust and their five mandatory duties$q$, array['TA19']),
  ($q$Drinking water testing and monitoring — confirmed against your supply's requirements$q$, array['WSA21', 'DWQAR22', 'DWQAR26']),
  ($q$Water treatment system — serviced and confirmed working (if applicable)$q$, array['WSA21', 'DWQAR22', 'DWQAR26']),
  ($q$Water supply classification and registration — confirmed with Taumata Arowai$q$, array['WSA21', 'TAMAR']),
  ($q$Water assessment recorded: source, who is supplied, how many people$q$, array['WSA21', 'TAMAR'])
) as v(name, keys)
where i.name = v.name and cardinality(i.source_keys) = 0;
