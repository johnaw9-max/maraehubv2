-- ClickUp 86d43fnk3 follow-up: dead-field findings are genuinely low-urgency,
-- ongoing data-entry gaps (not bugs) - the check itself keeps running and
-- logging daily (system_check_log stays accurate), but the admin email is
-- throttled to at most once every 7 days per check, so a known ongoing gap
-- doesn't spam daily. Only dead_field_detection uses this - every other
-- maintenance-shield check stays exactly as-is (daily), deliberately not
-- generalized into a per-check configurable interval - narrow, single-
-- purpose table, matching this check's own single-purpose scope.
create table if not exists check_alert_state (
  check_name text primary key,
  last_alerted_at timestamptz
);

alter table check_alert_state enable row level security;

create policy "check_alert_state: authenticated full access"
  on check_alert_state for all
  to authenticated
  using (true)
  with check (true);
