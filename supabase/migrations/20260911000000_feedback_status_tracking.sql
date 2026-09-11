-- Customer feedback follow-through check (86d3u7790, Stage 5 item 4).
-- The `feedback` table had no way to record that a bug/suggestion/question
-- was actually handled -- FounderDashboard only ever showed a read-only
-- last-20 feed. Without a real "addressed" signal, an automated
-- follow-through check can only flag by age, which can never go quiet once
-- something is actually handled (Waj fixes things in code/conversation, not
-- by ticking a box that didn't exist). Adding a minimal status field so the
-- new check has real ground truth to check against.
alter table feedback add column if not exists status text not null default 'open';
alter table feedback add column if not exists resolved_at timestamptz;

alter table feedback add constraint feedback_status_check
  check (status in ('open', 'resolved'));
