-- B1 · Organisation / Group on bookings (Jason Kurei, Ōpeke, 5 Nov 2026).
-- Adds one optional text column. No existing rows or policies are touched.
-- The website only sends this field when someone fills it in, so apply order
-- does not matter for existing flows.
alter table public.bookings add column if not exists organisation text;
alter table public.bookings drop constraint if exists bookings_organisation_len;
alter table public.bookings add constraint bookings_organisation_len
  check (organisation is null or char_length(organisation) <= 120);
