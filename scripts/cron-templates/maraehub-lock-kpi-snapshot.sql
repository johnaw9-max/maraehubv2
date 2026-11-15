-- job: maraehub-lock-kpi-snapshot   schedule (UTC): 5 0 1 * *
-- Calls lock-monthly-kpi-snapshot on THIS project only, authenticating with the project's own secret key held in
-- Vault as 'check_deadlines_secret_key' (created by provision-shield.sh). {{REF}} is
-- replaced by scripts/provision-cron.sh, which refuses to run if any other project
-- reference appears in the file.
select cron.unschedule(jobid) from cron.job where jobname = 'maraehub-lock-kpi-snapshot';
select cron.schedule('maraehub-lock-kpi-snapshot', '5 0 1 * *', $job$
  select net.http_post(
    url     := 'https://{{REF}}.supabase.co/functions/v1/lock-monthly-kpi-snapshot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'check_deadlines_secret_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb
  );
$job$);
