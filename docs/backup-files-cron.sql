-- Run once per project (replace <PROJECT_REF>), AFTER the function is deployed and the four BACKUP_ secrets are set.
-- Kept in docs, not supabase/migrations, so the migration-drift check does not expect it as an applied migration.
-- Applied: Opeke 11 Nov 2026. Terere and test still to do (Terere needs the service_role_key Vault secret first).
-- Schedules the nightly file backup. Replace <PROJECT_REF> before running
-- (same pattern as the other cron migrations). Times are UTC:
--   14:00 UTC = about 3am NZ: copy new and changed files
--   20:00 UTC = about 9am NZ: freshness check, alerts if no good run in 2 days
select cron.unschedule(jobid) from cron.job where jobname in ('maraehub-backup-files', 'maraehub-backup-freshness');

select cron.schedule(
  'maraehub-backup-files',
  '0 14 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/backup-files-to-s3',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

select cron.schedule(
  'maraehub-backup-freshness',
  '0 20 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/backup-files-to-s3',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' order by created_at desc limit 1)
    ),
    body    := '{"mode":"freshness"}'::jsonb
  );
  $$
);
