-- Universal Action Engine, Risk Register piece (14yhc7kq5ga). Adds the same
-- dedup-throttle column compliance_items and meeting_actions already have,
-- so the new risk-review cron reminder block can use the identical
-- at-most-once-per-window pattern rather than inventing a different
-- mechanism or resending daily forever.

alter table public.risk_register add column if not exists last_reminded_at timestamptz;
