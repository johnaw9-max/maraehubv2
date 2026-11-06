-- audit_log: immutable record of significant user actions
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null,
  user_id       uuid not null references auth.users(id),
  user_email    text,
  action        text not null,
  resource_type text not null,
  resource_id   text,
  resource_name text,
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now()
);

alter table public.audit_log enable row level security;

-- Trustees can read their own entity's audit log
create policy "trustees_read_own_entity_audit_log" on public.audit_log
  for select to authenticated using (is_entity_member(entity_id));

-- Any authenticated user can insert (the app controls what gets logged)
create policy "authenticated_insert_audit_log" on public.audit_log
  for insert to authenticated with check (true);

-- No UPDATE or DELETE — audit log is immutable
