-- Lets an admin trustee control the Opeke compliance/overdue-action email
-- pause themselves from Settings, instead of only Waj via a hardcoded
-- IS_OPEKE constant in notify-trustees. Default false everywhere -- Tineka
-- was never paused, so this is a no-op there. Opeke's existing row gets an
-- explicit UPDATE (separate, Opeke-only migration) to preserve the real
-- current paused state until someone actually flips the toggle.

alter table public.marae_settings add column if not exists reminders_paused boolean not null default false;
