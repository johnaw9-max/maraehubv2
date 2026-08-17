-- Adds a real Fire Warden flag to both tables backing the merged
-- Contacts list (profiles = real login trustees/community, contacts =
-- non-login address-book entries). Both need the column since one
-- shared form writes to either depending on whether an email is given.

alter table public.profiles add column is_fire_warden boolean not null default false;
alter table public.contacts add column is_fire_warden boolean not null default false;
