-- Phase 1, item 7 finding (P1-07b): notification_log open to anonymous callers.
-- Live on test, Terere and Ōpeke (verified 5 Nov 2026): policy
-- "Service role full access to notification_log" is FOR ALL TO public
-- USING (true) WITH CHECK (true), and anon has table grants. Anyone with the
-- website's public key, without signing in, could read, add or delete rows.
-- Rows hold only notification type/ids/trustee id/time, but fake rows could
-- suppress reminder emails, because notify-trustees de-duplicates against it.
--
-- The service role bypasses RLS, so this policy was never needed for the edge
-- functions that use the table (notify-trustees, check-deadlines). After this,
-- only the service role can use it. No app screen reads it.
begin;
drop policy if exists "Service role full access to notification_log" on public.notification_log;
revoke all on public.notification_log from anon, authenticated;
commit;
