-- Stores per-marae (or, if ever needed, per-entity) Xero OAuth connections.
-- Tokens are service_role-only — no client-facing RLS policies exist on this
-- table at all, so anon/authenticated get zero rows by default-deny. All
-- reads/writes happen inside Supabase Edge Functions using the service key.

create table xero_connections (
  id                        uuid primary key default gen_random_uuid(),
  entity_id                 uuid references entities(id) on delete cascade,
  tenant_id                 text not null unique,
  tenant_name               text,
  access_token              text not null,
  refresh_token             text not null,
  access_token_expires_at   timestamptz not null,
  scope                     text,
  connected_by              uuid references profiles(id) on delete set null,
  status                    text not null default 'active',
  connected_at              timestamptz not null default now(),
  last_refreshed_at         timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- At most one whole-marae connection (entity_id null) at a time — prevents
-- two different Xero orgs both claiming to be "the" marae-wide connection.
create unique index xero_connections_whole_marae_unique
  on xero_connections ((true))
  where entity_id is null;

-- At most one connection per specific entity, for the (currently unused)
-- per-entity case.
create unique index xero_connections_entity_unique
  on xero_connections (entity_id)
  where entity_id is not null;

alter table xero_connections enable row level security;
-- Intentionally no policies for anon/authenticated: RLS enabled + zero
-- policies = zero rows visible to those roles. Only service_role (which
-- bypasses RLS) can touch this table — i.e. only our Edge Functions.

-- Safe, narrow view for the Settings page connection-status UI (Part 3).
-- Structurally cannot leak tokens — they're not selected into it at all,
-- independent of any RLS consideration.
create view xero_connection_status as
  select entity_id, tenant_name, status, connected_at, last_refreshed_at
  from xero_connections;

grant select on xero_connection_status to authenticated;
