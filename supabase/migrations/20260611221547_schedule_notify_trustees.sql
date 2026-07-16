-- Schedule notify-trustees to run every day at 08:00 NZT (20:00 UTC previous day).
-- Run this in the Supabase SQL editor AFTER deploying the notify-trustees function
-- and setting the RESEND_API_KEY secret.
--
-- Replace <PROJECT_REF> with your Supabase project reference ID.
-- Test project:  zfefukxaliuximizjkwa
-- Live project:  cbeenkpjpnhmtqtnjiyd

-- Set the service role key so pg_cron can call the Edge Function.
-- Run once per project:
--   alter database postgres set app.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';

select cron.schedule(
  'maraehub-notify-trustees',
  '0 20 * * *',   -- 08:00 NZST (UTC+12) = 20:00 UTC previous day
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-trustees',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Verify:  select * from cron.job where jobname = 'maraehub-notify-trustees';
-- Remove:  select cron.unschedule('maraehub-notify-trustees');
