-- Rollback for B1. Dropping the column deletes any organisation text entered since.
alter table public.bookings drop constraint if exists bookings_organisation_len;
alter table public.bookings drop column if exists organisation;
