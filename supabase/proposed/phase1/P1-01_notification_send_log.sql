-- Phase 1, item 1 (P1-01): send log for notify-hirer rate limiting.
-- PROPOSED — not applied anywhere. Move into supabase/migrations and apply to TEST first, after John approves D-03.
--
-- Stores counts only: who sent (user id, or null for server callers), what
-- kind of caller, how many recipients, when. No email addresses, subjects or
-- bodies are stored.
--
-- RLS on with NO policies: only the service role (edge functions) can read or
-- write it. Trustees and the public cannot see it.
--
-- notify-hirer fails open if this table is missing (logs a warning and still
-- sends), so applying this migration late cannot interrupt notifications.
begin;

create table if not exists public.notification_send_log (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete set null,
  caller          text not null check (caller in ('server', 'trustee', 'member')),
  recipient_count integer not null check (recipient_count >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists notification_send_log_user_time_idx
  on public.notification_send_log (user_id, created_at desc);

alter table public.notification_send_log enable row level security;
revoke all on public.notification_send_log from anon, authenticated;

commit;
