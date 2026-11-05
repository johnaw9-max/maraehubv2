-- Rollback for 20261105000000_notification_send_log.sql.
-- Safe at any time: notify-hirer keeps sending without the table (rate limit
-- check is skipped with a logged warning).
begin;
drop table if exists public.notification_send_log;
commit;
