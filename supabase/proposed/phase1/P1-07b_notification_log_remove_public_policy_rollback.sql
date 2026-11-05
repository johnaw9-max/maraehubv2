-- Rollback for P1-07b: restores the previous open policy and grants.
begin;
drop policy if exists "Service role full access to notification_log" on public.notification_log;
create policy "Service role full access to notification_log" on public.notification_log
  for all to public using (true) with check (true);
grant select, insert, update, delete on public.notification_log to anon, authenticated;
commit;
