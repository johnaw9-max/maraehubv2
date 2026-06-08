-- Contacts table for community members added without a Supabase auth account.
-- profiles.id is a FK to auth.users, so no-email entries cannot go there.
-- This table holds the same shape (id, full_name, role, created_at) but has
-- no auth dependency.

create table if not exists contacts (
  id         uuid        primary key default gen_random_uuid(),
  full_name  text        not null,
  role       text        not null default 'community',
  created_at timestamptz default now()
);

alter table contacts enable row level security;

create policy "Authenticated users can manage contacts"
  on contacts for all
  to authenticated
  using (true)
  with check (true);
