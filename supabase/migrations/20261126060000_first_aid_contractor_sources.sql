-- First aid kit and contractor safety review: sources read in full on 26 Nov 2026 and written into the
-- Framework first (section 2.1; register HSWAR16). Wording now says "a PCBU must", not "employers must".
-- Guarded updates: only change an item that still has no source and its old wording. Safe to run more than once.
insert into public.legal_sources (key, name, kind, provisions_read, version_and_date_read, status, url, notes, checked_on)
values ('HSWAR16', 'Health and Safety at Work (General Risk and Workplace Management) Regulations 2016', 'legislation',
        'reg 13 (first aid), read in full', 'as at 10 Aug 2024 (LI 2016/13); read 26 Nov 2026',
        'Verified – primary source (regulation), reg 13 only',
        'https://www.legislation.govt.nz/regulation/public/2016/0013/latest/whole.html',
        'reg 13: a PCBU must provide first aid equipment, access and trained people; a volunteer association with no employees is not a PCBU (Act s 17)',
        '2026-11-26')
on conflict (key) do nothing;

update public.legal_sources
set provisions_read = 'ss 17, 18, 19, 34, 36, 44, 45, 46, 51, 52',
    version_and_date_read = 'as at 5 Apr 2025; read 22 Nov 2026 (s 34 read 26 Nov 2026)'
where key = 'HSWA15' and provisions_read = 'ss 17, 18, 19, 36, 44, 45, 46, 51, 52';

update public.compliance_items
set source_keys = array['HSWA15','HSWAR16'],
    legal_basis_detail = 'A PCBU (a marae that employs people) must provide adequate first aid equipment, make sure each worker can reach it, and make sure enough people are trained in first aid (Health and Safety at Work (General Risk and Workplace Management) Regulations 2016, reg 13). A volunteer-only marae is not a PCBU (Health and Safety at Work Act 2015, s 17), so for it a stocked first aid kit is good practice.'
where name = 'First aid kit — stocked and in date'
  and coalesce(cardinality(source_keys),0) = 0
  and legal_basis_detail = 'Employers must provide first aid facilities. For a volunteer-only marae it is good practice. Confirm with WorkSafe.'
  and (select count(*) from public.legal_sources where key in ('HSWA15','HSWAR16')) = 2;

update public.compliance_items
set source_keys = array['HSWA15'],
    legal_basis_detail = 'Where the marae is a PCBU (it employs people) and another PCBU has a duty for the same matter, each must, so far as is reasonably practicable, consult, co-operate with and co-ordinate activities with the other (Health and Safety at Work Act 2015, s 34). Whether a marae with no employees has any duty here has not yet been verified.'
where name = 'Contractor Health & Safety Management Review'
  and coalesce(cardinality(source_keys),0) = 0
  and legal_basis_detail = 'Where the marae engages contractors, duties to coordinate safety may apply. Confirm with WorkSafe.'
  and (select count(*) from public.legal_sources where key = 'HSWA15') = 1;
