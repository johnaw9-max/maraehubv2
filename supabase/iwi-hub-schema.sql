-- Iwi Hub schema (14yhc7knwwu) -- tracks the SEPARATE Supabase project(s)
-- provisioned per iwi (maraehub-iwi-hub-tainui, ref autzrcqblmxgiuibbvfa, is
-- the first one). NOT part of schema.sql, which tracks the marae project
-- schema deployed to every marae project (test project, Opeke, etc.) --
-- Iwi Hub is a genuinely separate product with its own, much smaller
-- schema, kept in its own file for the same reason schema.sql exists: a
-- real, version-controlled source of truth, not memory alone.

create table if not exists iwi_marae_snapshots (
  id uuid not null default gen_random_uuid(),
  marae_project_ref text not null,
  marae_name text,
  snapshot_month date,
  compliance_pct numeric,
  risk_pct numeric,
  assets_pct numeric,
  goals_pct numeric,
  pulled_at timestamp with time zone not null default now()
);

alter table iwi_marae_snapshots add constraint iwi_marae_snapshots_pkey primary key (id);
alter table iwi_marae_snapshots add constraint iwi_marae_snapshots_marae_month_key unique (marae_project_ref, snapshot_month);

alter table iwi_marae_snapshots enable row level security;
-- No policies yet -- fully locked down except through iwi-pull-snapshot's
-- service-role-equivalent access, same pattern as xero_connections /
-- google_calendar_connections. Real RLS policies for iwi_staff to read
-- this come with Step 5 (Iwi Hub's own Auth).
