-- Stage 5 of Fire Safety Readiness -- adds 2 real fire equipment
-- assets on Opeke, each with a paired service_reminder. Opeke's whole
-- assets register was found completely empty (0 rows) during this
-- audit -- these will be its only entries for now, flagged not hidden.
--
-- Real counts, locations, purchase dates and condition are unknown --
-- left null rather than fabricated, matching Stage 2's precedent.
-- due_date on service_reminders is NOT NULL (unlike compliance_items),
-- set to today since nothing has actually been checked yet -- an
-- honest "needs checking now" signal, not a guessed future schedule.
-- owner left null, matching Stages 2 and 4.

with fire_extinguishers as (
  insert into public.assets (name, category) values ('Fire Extinguishers', 'Equipment') returning id
), fire_alarms as (
  insert into public.assets (name, category) values ('Fire Alarms / Smoke Detectors', 'Equipment') returning id
)
insert into public.service_reminders (asset_id, type, due_date, recurring)
select id, 'Annual extinguisher service', current_date, true from fire_extinguishers
union all
select id, 'Alarm test / battery check', current_date, true from fire_alarms;
