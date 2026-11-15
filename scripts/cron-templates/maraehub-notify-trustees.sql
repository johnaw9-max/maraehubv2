-- job: maraehub-notify-trustees   schedule (UTC): 0 20 * * *
-- Calls notify-trustees on THIS project only, authenticating with the project's own secret key held in
-- Vault as 'check_deadlines_secret_key' (created by provision-shield.sh). {{REF}} is
-- replaced by scripts/provision-cron.sh, which refuses to run if any other project
-- reference appears in the file.
select cron.unschedule(jobid) from cron.job where jobname = 'maraehub-notify-trustees';
select cron.schedule('maraehub-notify-trustees', '0 20 * * *', $job$
  select net.http_post(
    url     := 'https://{{REF}}.supabase.co/functions/v1/notify-trustees',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'check_deadlines_secret_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb
  );
$job$);
