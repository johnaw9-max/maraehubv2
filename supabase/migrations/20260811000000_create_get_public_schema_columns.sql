-- ClickUp 86d3u7790, Stage 2d: schema.sql vs. live database drift check.
--
-- information_schema isn't reachable from check-deadlines via PostgREST -
-- confirmed directly against Opeke (Accept-Profile: information_schema
-- header returns HTTP 406). Same wall Stage 2c hit with cron and the
-- orphaned-auth check hit with auth - same fix: a SECURITY DEFINER wrapper.
--
-- Uses pg_class/pg_attribute rather than information_schema.columns to
-- mirror the exact query already proven correct building schema.sql itself
-- (20260810's re-sync) - one row per (table, column) pair, base tables
-- only (relkind = 'r'), excluding dropped columns.
--
-- Returns table/column names only, no data, no PII - not the same
-- sensitivity as find_orphaned_auth_users() (real email addresses), but
-- locked to service_role anyway rather than left at the PUBLIC default,
-- same discipline as every RPC this project has added.

create or replace function public.get_public_schema_columns()
returns table(table_name text, column_name text)
language sql
security definer
set search_path = public
as $$
  select c.relname::text as table_name, a.attname::text as column_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname, a.attnum;
$$;

revoke execute on function public.get_public_schema_columns() from public;
grant execute on function public.get_public_schema_columns() to service_role;
