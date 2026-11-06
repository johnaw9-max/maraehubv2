-- Lock down notification_send_log: authenticated users can insert, no reads via RLS
-- (service role reads directly; no SELECT policy means users cannot query it)
create policy "notification_log_insert" on public.notification_send_log
  for insert to authenticated with check (true);
