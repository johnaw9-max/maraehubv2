-- Adds dedup tracking for the overdue meeting-action reminder in check-deadlines.
-- Needed because the trigger is changing from an exact due_date match to a
-- catch-up range (due_date <= today - 7), so pre-existing overdue items get
-- caught too — without this column, that range would resend every single day
-- forever for anything still overdue and unresolved.

alter table meeting_actions
  add column if not exists last_reminded_at timestamptz;
