-- Add RLS policies to tables that had RLS enabled but no policies (Phase 1 P1-11).
-- Without policies, these tables are locked to everyone — adding correct policies
-- opens them only to the right users. Tables are intentionally locked to service_role
-- where end-users should never read/write directly.

-- ─── action_reminder_tokens ─────────────────────────────────────────────────
-- Trustees can read their own tokens (needed for action reminder email links).
-- Only service_role inserts/deletes (edge function manages lifecycle).
CREATE POLICY "trustees read own reminder tokens"
  ON public.action_reminder_tokens
  FOR SELECT
  TO authenticated
  USING (trustee_id = auth.uid());

-- ─── google_calendar_connections ─────────────────────────────────────────────
-- Highly sensitive: contains OAuth access + refresh tokens.
-- Owner-only read/update/delete; insert via service_role only.
CREATE POLICY "owner reads own calendar connection"
  ON public.google_calendar_connections
  FOR SELECT
  TO authenticated
  USING (trustee_id = auth.uid());

CREATE POLICY "owner updates own calendar connection"
  ON public.google_calendar_connections
  FOR UPDATE
  TO authenticated
  USING (trustee_id = auth.uid());

CREATE POLICY "owner deletes own calendar connection"
  ON public.google_calendar_connections
  FOR DELETE
  TO authenticated
  USING (trustee_id = auth.uid());

-- ─── incidents ───────────────────────────────────────────────────────────────
-- No user FK — entity-level safety/health records.
-- Trustees (admin) can read all; standard trustees can read too; service_role manages writes.
CREATE POLICY "trustees read incidents"
  ON public.incidents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trustee'
    )
  );

CREATE POLICY "trustees insert incidents"
  ON public.incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trustee'
    )
  );

CREATE POLICY "trustees update incidents"
  ON public.incidents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trustee'
    )
  );

CREATE POLICY "admin deletes incidents"
  ON public.incidents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trustee'
        AND profiles.trustee_role = 'admin'
    )
  );

-- ─── meeting_calendar_syncs ───────────────────────────────────────────────────
-- Trustees see their own calendar sync records.
CREATE POLICY "trustees read own calendar syncs"
  ON public.meeting_calendar_syncs
  FOR SELECT
  TO authenticated
  USING (trustee_id = auth.uid());

CREATE POLICY "trustees insert own calendar syncs"
  ON public.meeting_calendar_syncs
  FOR INSERT
  TO authenticated
  WITH CHECK (trustee_id = auth.uid());

CREATE POLICY "trustees delete own calendar syncs"
  ON public.meeting_calendar_syncs
  FOR DELETE
  TO authenticated
  USING (trustee_id = auth.uid());

-- ─── notification_log ────────────────────────────────────────────────────────
-- Trustees see their own notification history.
CREATE POLICY "trustees read own notification log"
  ON public.notification_log
  FOR SELECT
  TO authenticated
  USING (trustee_id = auth.uid());

-- ─── stripe_webhook_events ───────────────────────────────────────────────────
-- Internal webhook audit log — no direct user access.
-- service_role bypasses RLS so it can still write; anon/authenticated get nothing.
-- (No policy needed for authenticated to block them — having RLS with no matching policy blocks all.)
-- Adding a deny-all explicit policy for clarity is not needed; RLS with no policy = no access.
-- But we need at least one policy or Supabase keeps warning. Add an admin-only read:
CREATE POLICY "admin reads stripe events"
  ON public.stripe_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trustee'
        AND profiles.trustee_role = 'admin'
    )
  );

-- ─── xero_connections ────────────────────────────────────────────────────────
-- Sensitive: contains Xero OAuth tokens scoped to an entity.
-- Entity admins can read their own entity's connection; service_role manages tokens.
CREATE POLICY "entity admins read xero connection"
  ON public.xero_connections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trustee'
        AND profiles.trustee_role = 'admin'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.trustee_entities te
        WHERE te.profile_id = auth.uid()
          AND te.entity_id = xero_connections.entity_id
      )
      OR connected_by = auth.uid()
    )
  );

CREATE POLICY "entity admins delete xero connection"
  ON public.xero_connections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trustee'
        AND profiles.trustee_role = 'admin'
    )
    AND connected_by = auth.uid()
  );

-- ─── notification_send_log (test project only — may not exist on Opeke) ──────
-- Guards the DO $$ block with an existence check so this migration is safe on
-- projects that don't have the table yet.
-- notification_send_log uses user_id (not trustee_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'notification_send_log'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "users read own send log"
        ON public.notification_send_log
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid())
    $policy$;
  END IF;
END $$;

-- ─── Revoke unneeded EXECUTE grants on trigger-only functions ────────────────
-- (handle_new_auth_user already revoked in previous migration on Opeke;
--  safe to run again — REVOKE is idempotent when already revoked.)
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;

-- update_last_sign_in: trigger-only, revoke unnecessary public grants
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_last_sign_in'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_last_sign_in() FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_last_sign_in() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_last_sign_in() FROM authenticated';
  END IF;
END $$;
