select 'check_deadlines_cron_job_active' as check_name,
  exists(
    select 1 from cron.job
    where jobname = 'maraehub-check-deadlines' and active
  ) as result

union all
select 'check_deadlines_cron_uses_apikey_header',
  exists(
    select 1 from cron.job
    where jobname = 'maraehub-check-deadlines'
      and command like '%''apikey''%'
      and command not like '%Authorization%'
  )

union all
select 'check_deadlines_vault_secret_exists',
  exists(
    select 1 from vault.decrypted_secrets where name = 'check_deadlines_secret_key'
  );
