-- Documents update_last_sign_in() and its on_auth_sign_in trigger, which
-- existed live on Tineka but had no migration file anywhere in this repo -
-- untracked infrastructure, discovered while fixing a login bug 2026-07-24.
--
-- Root cause, found via Supabase Auth Logs: the original function referenced
-- `profiles` unqualified. SECURITY DEFINER functions don't inherit the
-- definer's search_path - they use whatever search_path the CALLING
-- session has, unless explicitly overridden. Testing directly via
-- `supabase db query` always succeeded (that session's search_path
-- includes public by default) and masked the bug - but GoTrue's own
-- connection context does not have public in its search_path, so every
-- real login failed with:
--   ERROR: relation "profiles" does not exist (SQLSTATE 42P01)
-- surfacing to users as the generic "Database error granting user".
--
-- This migration contains only the function fix. The on_auth_sign_in
-- trigger on auth.users already exists and is not recreated here - Supabase
-- restricts ALTER/CREATE TRIGGER on auth.users to the table owner, which
-- the migration-running role is not (confirmed via a permission error while
-- debugging this same issue), so this trigger can only be managed via the
-- Supabase SQL Editor, not standard migration tooling.
--
-- Not present on Opeke: confirmed Opeke never had this trigger/function at
-- all (only handle_new_auth_user, a different, already-correctly-qualified
-- trigger). This migration documents Tineka's fix only; it does not add
-- the feature to Opeke.

create or replace function public.update_last_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  update profiles set last_sign_in_at = now()
  where id = new.id;
  return new;
end;
$function$;
