-- Fixes the service-role-key auth mechanism used by the cron jobs defined in
-- 20260609205052_schedule_deadline_checks.sql and
-- 20260721000001_schedule_kpi_snapshot_lock.sql.
--
-- Root cause (confirmed 2026-07-22 on Terere/Opeke, cbeenkpjpnhmtqtnjiyd):
-- both original files authenticate via current_setting('app.service_role_key'),
-- which requires `ALTER DATABASE postgres SET app.service_role_key = '...'`
-- to have been run first. That fails on Supabase's managed Postgres:
--   ERROR: 42501: permission denied to set parameter "app.service_role_key"
-- The CLI/dashboard role is not a superuser and cannot set custom database-
-- level GUCs. The two files above are left unmodified (beyond a pointer
-- comment) — 20260609205052 is already recorded as applied in
-- supabase_migrations.schema_migrations, so editing it in place would
-- silently drift from what Supabase's migration history thinks ran, and a
-- future `db push` replay would never pick up a fix made in place. This
-- migration supersedes their auth mechanism instead.
--
-- Prerequisite — run ONCE per project, BEFORE this file, as its own guarded
-- shell step (never paste the raw key into a file). Wrapped in an existence
-- check because vault.secrets has no unique constraint on `name`, so a
-- careless rerun would otherwise create a duplicate secret:
--   do $$
--   begin
--     if not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') then
--       perform vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key',
--         'Used by pg_cron jobs to authenticate calls to Edge Functions');
--     end if;
--   end $$;
--
-- Then replace <PROJECT_REF> below and run this file.

-- Idempotent: drop prior registrations of both jobs if they exist.
select cron.unschedule(jobid) from cron.job where jobname = 'maraehub-check-deadlines';
select cron.unschedule(jobid) from cron.job where jobname = 'maraehub-lock-kpi-snapshot';

select cron.schedule(
  'maraehub-check-deadlines',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-deadlines',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'maraehub-lock-kpi-snapshot',
  '5 0 1 * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/lock-monthly-kpi-snapshot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To verify both jobs registered:
--   select jobid, jobname, schedule, active from cron.job
--   where jobname in ('maraehub-check-deadlines','maraehub-lock-kpi-snapshot');
