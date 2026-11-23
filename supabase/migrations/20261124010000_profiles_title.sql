-- Our Marae, the org chart and Create Trustee use a job title on each person (profiles.title).
-- It was added by hand on Terere on 23 Nov 2026 without a migration; Opeke and Test do not have it, so Our Marae showed
-- "No trustees found" there and the Title box would fail. Additive and nullable. Re-running is harmless. No data is touched.
alter table public.profiles add column if not exists title text;
