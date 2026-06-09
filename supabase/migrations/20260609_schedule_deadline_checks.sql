-- Schedule the check-deadlines Edge Function to run every day at 08:00 UTC.
-- Requires: pg_cron and pg_net extensions (both enabled in Supabase by default).
--
-- Run this in the Supabase SQL editor AFTER deploying the check-deadlines function.
-- Replace <PROJECT_REF> with your Supabase project ref (found in project Settings → General).

select cron.schedule(
  'maraehub-check-deadlines',          -- job name (must be unique)
  '0 8 * * *',                          -- every day at 08:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-deadlines',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To verify the job was created:
-- select * from cron.job where jobname = 'maraehub-check-deadlines';

-- To remove the job later:
-- select cron.unschedule('maraehub-check-deadlines');
