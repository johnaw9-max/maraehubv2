-- Extends the storage security shield (14yhc7kv4t3 follow-up) with its own
-- Check-C RPC: storage.objects policies (name/cmd/roles) combined with
-- storage.buckets' public flag, in one SECURITY DEFINER round trip, same
-- pg_policies/storage.buckets wall every prior Stage RPC hit (not
-- PostgREST-exposed). Locked to service_role from creation, applying the
-- project's own established lesson rather than fixing it after the fact --
-- and self-allowlisted in ALLOWED_SECURITY_DEFINER_GRANTS in the same
-- edit, same self-referential gap every prior Check-RPC hit
-- (get_anon_granted_policies, get_security_definer_function_grants,
-- get_storage_buckets, check_column_generated all needed this same fix).
--
-- Single flat table with a `kind` discriminator ('policy' or 'bucket')
-- rather than two separate RPCs or a nested jsonb shape -- cheapest way to
-- return two differently-shaped rowsets from one SQL function, and the
-- edge function only needs to filter by `kind` to use either half.

create or replace function public.get_storage_security_posture()
returns table(kind text, name text, cmd text, roles text[], is_public boolean)
language sql
security definer
set search_path = public
as $$
  select 'policy'::text, policyname, cmd, roles::text[], null::boolean
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
  union all
  select 'bucket'::text, id, null::text, null::text[], public
  from storage.buckets;
$$;

revoke all on function public.get_storage_security_posture() from public, anon, authenticated;
grant execute on function public.get_storage_security_posture() to service_role;
