-- Sets a real, concrete first due_date on the Fire alarms compliance
-- item on Opeke -- 30 days from creation, giving trustees a genuine
-- first checkpoint. Activates the existing email/Task Board reminder
-- pipeline (both require a non-null due_date -- see notify-trustees
-- and ComplianceTracker.js createOverdueTasks/createUpcomingTasks).

update public.compliance_items
set due_date = current_date + interval '30 days'
where name = 'Fire alarms — tested and detection confirmed working';
