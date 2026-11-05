-- Rollback for M1: restores the exact previous rule and permissions.
begin;
drop policy if exists "Service role full access to notification_log" on public.notification_log;
create policy "Service role full access to notification_log" on public.notification_log
  for all to public using (true) with check (true);
grant all on public.notification_log to anon, authenticated;
commit;
