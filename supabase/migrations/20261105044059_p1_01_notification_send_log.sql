-- notification_send_log: immutable audit trail of every notification sent
create table if not exists public.notification_send_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id),
  caller      text not null,
  recipient_count integer not null,
  created_at  timestamptz not null default now()
);

alter table public.notification_send_log enable row level security;

-- Service-role only (no user-facing policies — read via admin dashboard)
