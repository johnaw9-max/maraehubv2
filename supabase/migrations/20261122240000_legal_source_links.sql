-- Official links for six sources, each opened and checked on 22 Nov 2026. Version and date wording corrected where the page shows a date.
-- LIM25 still has no link: the official page was not found, so it stays blank rather than guessed.
-- Source of truth is the Framework, Appendix C.2. Only these six rows change; re-running is harmless.
update public.legal_sources set url = $q$https://www.legislation.govt.nz/secondary-legislation/pco-drafted/1994/57/en/latest/$q$ where key = 'MRR94';
update public.legal_sources set url = $q$https://www.legislation.govt.nz/act/public/2017/17/en/latest/$q$ where key = 'FENZ17';
update public.legal_sources set url = $q$https://worksafe.govt.nz/laws-and-regulations/operational-policy-framework/worksafe-positions/officers-due-diligence/$q$, version_and_date_read = $q$page last updated 4 Sep 2017; read 22 Nov 2026$q$ where key = 'WSOFF';
update public.legal_sources set url = $q$https://www.worksafe.govt.nz/managing-health-and-safety/getting-started/understanding-the-law/volunteers/keeping-volunteers-healthy-and-safe/$q$, version_and_date_read = $q$guidance dated September 2024; page read 22 Nov 2026$q$ where key = 'WSVOL';
update public.legal_sources set url = $q$https://www.building.govt.nz/managing-buildings/managing-your-bwof$q$, version_and_date_read = $q$page last updated 26 Nov 2024; read 22 Nov 2026$q$ where key = 'BGBWOF';
update public.legal_sources set url = $q$https://www.justice.govt.nz/assets/20210715-Trustees-Role-and-Duties.pdf$q$, version_and_date_read = $q$date not stated on the document (form code MOJ0217.2E_JUL21); read 22 Nov 2026$q$ where key = 'MLC';
