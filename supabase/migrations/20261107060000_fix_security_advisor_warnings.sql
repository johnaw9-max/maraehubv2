-- Fix security advisor warnings (Phase 1 security task [3]).
--
-- 1. Revoke unnecessary EXECUTE grants on handle_new_auth_user (trigger-only function;
--    anon/authenticated/PUBLIC grants serve no purpose).
-- 2. Add SET search_path = 'public' to functions flagged for mutable search_path.
--    These are SECURITY INVOKER so risk is low, but fixing silences the advisory.

-- ─── 1. handle_new_auth_user: revoke unneeded grants ───────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;
-- service_role and postgres remain; the trigger fires as postgres/service_role.

-- ─── 2. Fix mutable search_path on SECURITY INVOKER functions ───────────────

CREATE OR REPLACE FUNCTION public.is_entity_member(check_entity_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = 'public'
AS $$
  SELECT check_entity_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'trustee' AND profiles.trustee_role = 'admin')
    OR EXISTS (SELECT 1 FROM trustee_entities te WHERE te.profile_id = auth.uid() AND te.entity_id = check_entity_id);
$$;

CREATE OR REPLACE FUNCTION public.check_journal_lines_balance()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT journal_entry_id, count(*) AS n, sum(debit) - sum(credit) AS diff
    FROM new_lines
    GROUP BY journal_entry_id
  LOOP
    IF r.n < 2 THEN
      RAISE EXCEPTION 'Journal entry % must have at least 2 lines in one insert (got %)', r.journal_entry_id, r.n;
    END IF;
    IF abs(r.diff) > 0.01 THEN
      RAISE EXCEPTION 'Journal entry % does not balance: debit-credit diff = %', r.journal_entry_id, r.diff;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_founder()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = 'public'
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') = ANY (ARRAY['johnaw9@gmail.com', 'waj@maraehub.co.nz']);
$$;

CREATE OR REPLACE FUNCTION public.profiles_protect_permission_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.trustee_role IS DISTINCT FROM OLD.trustee_role)
     AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'You cannot change your own role or trustee_role.';
  END IF;
  RETURN NEW;
END;
$$;
