-- Opeke counterpart to 20260817070000. Same real fix, real Opeke
-- project ref substituted, same vault.decrypted_secrets auth pattern
-- already proven working live by maraehub-check-deadlines and
-- maraehub-lock-kpi-snapshot on this project. Verified working
-- end-to-end on Tineka first (manual trigger, 200 OK, 6 real emails
-- sent) before applying here -- not manually triggered here, since
-- that would email Opeke's real trustees outside their normal 8am
-- schedule; registration/config verified instead.

select cron.unschedule('maraehub-notify-trustees')
where exists (select 1 from cron.job where jobname = 'maraehub-notify-trustees');

select cron.schedule(
  'maraehub-notify-trustees',
  '0 20 * * *',
  $$
  select net.http_post(
    url     := 'https://cbeenkpjpnhmtqtnjiyd.supabase.co/functions/v1/notify-trustees',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);
