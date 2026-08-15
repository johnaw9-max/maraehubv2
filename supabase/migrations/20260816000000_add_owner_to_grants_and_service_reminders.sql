-- Adds an owner (text) column to grants and service_reminders, matching
-- risk_register's naming convention. Neither table previously had any
-- owner/responsible-trustee column at all -- grants.contact_name/
-- contact_email is the external funder's contact, not a marae-side owner
-- (ClickUp 86d41pdmk / 86d41pdmm).

alter table public.grants add column owner text;
alter table public.service_reminders add column owner text;
