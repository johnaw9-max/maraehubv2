-- Stage 4 (process/config safety checks, ClickUp 86d3u7790) — storage.buckets
-- isn't PostgREST-exposed (same wall as cron/auth/information_schema every
-- prior stage hit), so this goes through a SECURITY DEFINER RPC, same
-- pattern as get_public_schema_columns()/get_anon_granted_policies().
-- Locked to service_role from creation, applying Stage 2d/3's own lesson
-- from day one rather than fixing it after the fact.

create or replace function public.get_storage_buckets()
returns table(id text, name text, public boolean)
language sql
security definer
set search_path = public
as $$
  select id, name, public from storage.buckets order by id;
$$;

revoke all on function public.get_storage_buckets() from public, anon, authenticated;
grant execute on function public.get_storage_buckets() to service_role;
