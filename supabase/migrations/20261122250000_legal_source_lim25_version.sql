-- LIM25: John supplied the current official PDF, read in full on 22 Nov 2026. It is version 25.0 as at 1 Oct 2026
-- (the earlier read was version 16.0). The Planning Act 2026 amended regs 3, 8(1)(a)(i) and 12 only; regs 2 and 8 content used by the app is unchanged.
-- Source of truth is the Framework, Appendix C.2. One row changes; re-running is harmless. Link stays blank until the live page is opened and checked.
update public.legal_sources set version_and_date_read = $q$version 25.0 as at 1 Oct 2026 (replaces version 16.0 read earlier); read in full 22 Nov 2026$q$ where key = 'LIM25';
