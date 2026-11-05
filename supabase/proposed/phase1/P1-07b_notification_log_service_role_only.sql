-- M1 · P1-07b · notification_log: service role only.
-- Removes ONE access rule and the table permissions of the two public API roles.
-- No rows, columns or tables are changed or deleted.
--
-- Before: policy "Service role full access to notification_log" applied to role
-- PUBLIC (everyone) with condition true, and anon/authenticated held
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE. Despite its name, it let anyone with the
-- website's public key read and write the table without logging in.
-- After: only service_role (used by notify-trustees and check-deadlines, which
-- bypasses RLS) and the postgres owner can use the table. No app screen reads it.
begin;
drop policy if exists "Service role full access to notification_log" on public.notification_log;
revoke all on public.notification_log from anon, authenticated;
grant select, insert, update, delete on public.notification_log to service_role;  -- explicit; already held
commit;
