-- Migrates the maraehub-check-deadlines cron job off the legacy service_role
-- key and onto a new, check-deadlines-only sb_secret_ key.
--
-- Why a separate key instead of reusing the shared 'service_role_key' Vault
-- secret from 20260722000000_fix_cron_vault_auth.sql: that secret is also
-- used by maraehub-lock-kpi-snapshot and both notify-trustees cron jobs.
-- Deactivating the legacy service_role key later requires migrating those
-- too -- untouched here, out of scope for this change.
--
-- Why the header changes from Authorization: Bearer to apikey: the new
-- sb_secret_ keys are not JWTs, so the platform's JWT parser rejects them on
-- Authorization: Bearer. Supabase's documented fix is to send them on the
-- apikey header instead, and set verify_jwt = false on the function (done in
-- supabase/config.toml) since the gateway can no longer verify the key
-- itself -- check-deadlines/index.ts now checks the apikey header manually.
--
-- Prerequisite -- run ONCE per project, BEFORE this file, as its own guarded
-- shell step (never paste the raw key into a file). Wrapped in an existence
-- check for the same reason as the original: vault.secrets has no unique
-- constraint on `name`, so a careless rerun would create a duplicate secret:
--   do $$
--   begin
--     if not exists (select 1 from vault.decrypted_secrets where name = 'check_deadlines_secret_key') then
--       perform vault.create_secret('<NEW_SECRET_KEY>', 'check_deadlines_secret_key',
--         'apikey header value for pg_cron -> check-deadlines gateway auth, new sb_secret_ format, check-deadlines-only');
--     end if;
--   end $$;
--
-- Two real gotchas hit while doing this on the test project (zfefukxaliuximizjkwa,
-- 2026-09-11) -- both silent failures, not obvious from any error message:
--
-- 1. A secret key just created via `POST /v1/projects/{ref}/api-keys` is NOT
--    immediately valid at the gateway, even though the Management API returns
--    201 and the key looks well-formed. The gateway rejects it with a generic
--    401 `{"message":"Invalid API key", "hint":"...might also be owned by
--    another Supabase project."}` regardless of how long you wait or how many
--    times you retry -- this is not ordinary eventual-consistency lag (10
--    retries over 4 minutes did not resolve it). What did resolve it: a full
--    project restart (Dashboard -> Settings -> General -> Restart project).
--    There is no Management API endpoint for this restart -- it has to be
--    done from the Dashboard. Do this AFTER creating the key and BEFORE
--    testing/deploying against it.
--
-- 2. `POST /v1/projects/{ref}/api-keys` (create) and
--    `GET /v1/projects/{ref}/api-keys/{id}?reveal=true` return DIFFERENT byte
--    strings for the *same* key id -- confirmed reproducibly on two separate
--    keys. Whichever value you store in Vault and as the CHECK_DEADLINES_SECRET_KEY
--    edge function secret MUST come from the GET reveal call, taken AFTER the
--    restart in #1, not from the original create response -- the create
--    response's value is never the one the gateway actually ends up
--    recognizing. Using the create-response value produces the same generic
--    "Invalid API key" 401 as #1, which makes the two issues easy to
--    conflate; they are separate and both must be worked around.
--
-- Then replace <PROJECT_REF> below and run this file.

select cron.unschedule(jobid) from cron.job where jobname = 'maraehub-check-deadlines';

select cron.schedule(
  'maraehub-check-deadlines',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey',       (select decrypted_secret from vault.decrypted_secrets where name = 'check_deadlines_secret_key' order by created_at desc limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To verify:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'maraehub-check-deadlines';
