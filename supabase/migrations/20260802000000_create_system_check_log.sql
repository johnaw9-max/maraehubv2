-- Run history for check-deadlines' automated data-integrity checks (ClickUp
-- 86d3u7790). One row per check per run, so there's a visible "checked,
-- found nothing" vs "checked, found X" record over time, not just silence
-- when everything's clean. check_name distinguishes which check ran, since
-- more checks (Stages 2-5) will log to this same table later.

create table if not exists system_check_log (
  id              uuid        primary key default gen_random_uuid(),
  check_name      text        not null,
  run_at          timestamptz not null default now(),
  findings_count  integer     not null default 0,
  details         jsonb       not null default '[]'::jsonb
);

alter table system_check_log enable row level security;

drop policy if exists "system_check_log: authenticated full access" on system_check_log;

create policy "system_check_log: authenticated full access"
  on system_check_log for all
  to authenticated
  using (true)
  with check (true);
