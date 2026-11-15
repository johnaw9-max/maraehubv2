-- job: maraehub-backup-freshness   schedule (UTC): 0 20 * * *
-- Calls backup-files-to-s3 on THIS project only, authenticating with the project's own secret key held in
-- Vault as 'check_deadlines_secret_key' (created by provision-shield.sh). {{REF}} is
-- replaced by scripts/provision-cron.sh, which refuses to run if any other project
-- reference appears in the file.
select cron.unschedule(jobid) from cron.job where jobname = 'maraehub-backup-freshness';
select cron.schedule('maraehub-backup-freshness', '0 20 * * *', $job$
  select net.http_post(
    url     := 'https://{{REF}}.supabase.co/functions/v1/backup-files-to-s3',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'check_deadlines_secret_key' order by created_at desc limit 1)
    ),
    body    := '{"mode":"freshness"}'::jsonb
  );
$job$);
