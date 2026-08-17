-- Real fix for a genuine, both-projects gap found 17 Aug 2026: the
-- notify-trustees Edge Function (compliance/booking/grant/meeting
-- email reminders) is deployed and has working secrets, but was never
-- actually scheduled -- the original 20260611221547 migration was a
-- manual runbook with a literal <PROJECT_REF> placeholder never
-- substituted, and used current_setting('app.service_role_key'),
-- which was never set on either project either.
--
-- This migration schedules it for real, matching the exact
-- vault.decrypted_secrets auth pattern already proven working live by
-- maraehub-check-deadlines and maraehub-lock-kpi-snapshot, with the
-- real project ref substituted per environment (see below).
--
-- Schedule: '0 20 * * *' UTC = 08:00 NZST (checked against pg_cron's
-- actual run history for maraehub-check-deadlines, which fires at
-- literal 08:00:00 UTC -- meaning THAT job actually runs at 8pm NZST,
-- not 8am as the Help Menu claims. That is a separate, real
-- discrepancy, not fixed here -- flagging only. notify-trustees is
-- scheduled here for the genuinely correct 8am NZST instead.

select cron.unschedule('maraehub-notify-trustees')
where exists (select 1 from cron.job where jobname = 'maraehub-notify-trustees');

select cron.schedule(
  'maraehub-notify-trustees',
  '0 20 * * *',
  $$
  select net.http_post(
    url     := 'https://zfefukxaliuximizjkwa.supabase.co/functions/v1/notify-trustees',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);
