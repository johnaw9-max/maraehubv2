-- FENZR18: Schedule 2 and regs 3, 5 to 17 were read in full on 23 Nov 2026 from the stored copy (version as at 22 Oct 2025), in addition to regs 25 and 29 to 34.
-- Source of truth is the Framework, Appendix C.2. One row changes; re-running is harmless.
update public.legal_sources set
  provisions_read = $q$Schedule 2, regs 3, 5 to 17, 25, 29 to 34$q$,
  notes = $q$Part 1 applies to Schedule 2 buildings (includes halls, places of assembly, places of public worship and other buildings the public are admitted to); 6-monthly trials, reg 29(1)(a)$q$
where key = 'FENZR18';
