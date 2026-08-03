-- Exposes cron.job/cron.job_run_details (not reachable from check-deadlines,
-- which talks to the database only via PostgREST/supabase-js - confirmed
-- empirically: `Accept-Profile: cron` against /rest/v1/job returns
-- PGRST106 "Invalid schema: cron", since only public and graphql_public are
-- exposed schemas) through a narrow SECURITY DEFINER wrapper in public, for
-- Stage 2c's cron-actually-firing check (ClickUp 86d3u7790).
--
-- Matches by job.command LIKE pattern rather than a hardcoded jobid - both
-- projects currently have lock-monthly-kpi-snapshot at jobid 2, but matching
-- on the function name embedded in the command is robust to that changing,
-- and lets this same function be reused for other jobs later without
-- modification.

create or replace function public.check_cron_job_last_success(job_name_pattern text)
returns timestamptz
language sql
security definer
set search_path = public
as $$
  select max(jrd.start_time)
  from cron.job_run_details jrd
  join cron.job j on j.jobid = jrd.jobid
  where j.command like job_name_pattern
    and jrd.status = 'succeeded';
$$;
