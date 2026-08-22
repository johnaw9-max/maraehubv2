-- Task 4 (ClickUp 86d42yxhx): dedup column for the new proactive
-- overdue-compliance email alert in check-deadlines, mirroring
-- meeting_actions.last_reminded_at exactly (nullable, no default).
alter table compliance_items add column last_reminded_at timestamp with time zone;
