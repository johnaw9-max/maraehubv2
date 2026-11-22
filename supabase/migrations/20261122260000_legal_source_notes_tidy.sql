-- Tidy the notes on six sources: five still said "link to add" although their links were added on 22 Nov 2026,
-- and one note read like an internal remark. Source of truth is the Framework, Appendix C.2. Re-running is harmless.
update public.legal_sources set notes = null where key in ('BGBWOF','MLC','WSOFF','WSVOL') and notes ilike '%link to add%';
update public.legal_sources set notes = $q$Applies to Māori reservations$q$ where key = 'MRR94' and notes ilike '%link to add%';
update public.legal_sources set notes = $q$FENZ's page says "can gather"; the Act says "used for". The Act's wording is what counts.$q$ where key = 'FENZES';
