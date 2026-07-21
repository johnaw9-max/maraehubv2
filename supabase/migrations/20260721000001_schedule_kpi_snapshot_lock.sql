-- Schedule the lock-monthly-kpi-snapshot Edge Function to run at 00:05 UTC
-- on the 1st of every month, locking in last month's Compliance/Risk/Assets/
-- Goals percentages into module_kpi_snapshots.
--
-- Requires: pg_cron and pg_net extensions.
--
-- IMPORTANT — as of 2026-07-21, neither extension is enabled on either live
-- project (Opeke or Tineka), and the equivalent existing job for
-- check-deadlines (see 20260609205052_schedule_deadline_checks.sql) was never
-- actually registered either, despite that function showing as "deployed".
-- Enabling pg_cron requires the Supabase Dashboard → Database → Extensions
-- toggle on each project (some plans block `create extension pg_cron` from
-- plain SQL) — do that FIRST, then run this file in the SQL editor AFTER
-- deploying the lock-monthly-kpi-snapshot function, replacing <PROJECT_REF>.
--
-- Do not consider this step done just because this migration exists or the
-- function is deployed — verify the job is actually firing afterward with:
--   select * from cron.job where jobname = 'maraehub-lock-kpi-snapshot';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'maraehub-lock-kpi-snapshot')
--     order by start_time desc limit 5;

select cron.schedule(
  'maraehub-lock-kpi-snapshot',        -- job name (must be unique)
  '5 0 1 * *',                          -- 00:05 UTC on the 1st of every month
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/lock-monthly-kpi-snapshot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To remove the job later:
-- select cron.unschedule('maraehub-lock-kpi-snapshot');
