-- Same reasoning as 20260817060000 (Fire alarms): real, concrete
-- first checkpoint, 30 days from creation, activates the now-fixed
-- notify-trustees pipeline and moves the dashboard status off Not Set.

update public.compliance_items
set due_date = current_date + interval '30 days'
where name = 'Emergency exits — checked clear, signed and operational';
