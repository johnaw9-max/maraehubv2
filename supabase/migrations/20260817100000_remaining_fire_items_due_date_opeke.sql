-- Same reasoning as Fire alarms (ba89b4f) and Emergency exits
-- (092903c): real, concrete first checkpoint, 30 days from creation,
-- for the remaining 3 of the 5 fire safety compliance items.

update public.compliance_items
set due_date = current_date + interval '30 days'
where name in (
  'Fire extinguishers — inspected and serviced',
  'Evacuation scheme — reviewed and trial evacuation completed',
  'Fire warden arrangements — trained and refreshed'
);
