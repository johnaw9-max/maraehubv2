-- Run this in the Waioweka (Sandbox) Supabase SQL Editor
-- https://supabase.com/dashboard/project/kifqftelvliywqkizsho/sql

-- 1. Add last_sign_in_at to profiles if it doesn't already exist
alter table profiles add column if not exists last_sign_in_at timestamptz;

-- 2. Backfill from auth.users
update profiles p
set last_sign_in_at = u.last_sign_in_at
from auth.users u
where p.id = u.id;

-- 3. Create the login activity RPC (same as Terere)
create or replace function get_trustee_login_activity()
returns table(id uuid, full_name text, email text, last_sign_in_at timestamptz)
security definer
set search_path = public
language sql as $$
  SELECT p.id, p.full_name, u.email, u.last_sign_in_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'trustee'
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
$$;

grant execute on function get_trustee_login_activity() to anon, authenticated;
