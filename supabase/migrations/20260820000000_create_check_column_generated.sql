-- ClickUp 86d438jjv check #2: distinguishes a genuinely dead column (no
-- write path) from a Postgres GENERATED ALWAYS column whose real source
-- fields are simply empty — see 86d42yxhx Task 1 for the real incident
-- this came from (assets.replacement_date looked dead, was actually
-- DB-generated, wrong diagnosis briefly broke a live save).
--
-- information_schema isn't reachable from check-deadlines via PostgREST
-- (only public and graphql_public are exposed - same wall Stage 2c hit
-- with cron and the orphaned-auth check hit with auth), so this goes
-- through a SECURITY DEFINER wrapper, same pattern as those two.
--
-- Returns schema metadata only, not user data - left at the default
-- PUBLIC execute, same as check_cron_job_last_success() (not locked to
-- service_role like find_orphaned_auth_users(), which returns real PII).

create or replace function public.check_column_generated(p_table text, p_column text)
returns table(is_generated boolean, generation_expression text)
language sql
security definer
set search_path = public
as $$
  select (c.is_generated = 'ALWAYS'), c.generation_expression
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table and c.column_name = p_column;
$$;
