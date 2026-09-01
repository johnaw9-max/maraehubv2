-- Founder Capacity Check (ClickUp 86d3u7790 Stage 5 item 3). Seeds
-- check_alert_state so the first real nudge lands ~30 days from here,
-- not immediately on deploy. 2026-08-17 is the real date the Business
-- Survival Checkpoint (86d426vgx) was first raised -- seeding from that
-- date, not today, means the first fire naturally lands around
-- 16 September 2026, matching both source tasks' own stated real
-- timing ("30-60 days from [17 Aug]", "first real occurrence
-- mid-September") rather than an arbitrary date chosen now.
insert into check_alert_state (check_name, last_alerted_at)
values ('founder_capacity_check', '2026-08-17T00:00:00Z')
on conflict (check_name) do nothing;
