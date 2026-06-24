-- Add opt-out flag to service_reminders.
-- When auto_workflow_enabled = false a trustee has opted this reminder out
-- of the daily auto-workflow trigger in check-deadlines.

alter table service_reminders
  add column if not exists auto_workflow_enabled boolean not null default true;
