-- Fixes 2 real schema_drift findings from the 16 August investigation
-- (86d3u7790) -- both real, populated features on Opeke that Tineka's
-- schema had fallen behind on, genuinely untestable there until now.
-- Structure copied exactly from the freshly re-synced schema.sql (sourced
-- from live Opeke). Tineka-only -- Opeke already has both.

create table if not exists founder_notes (
  marae_name text not null,
  step_key text not null,
  completed boolean not null default false,
  updated_at timestamp with time zone default now(),
  data jsonb
);

alter table founder_notes add constraint founder_notes_pkey primary key (marae_name, step_key);

alter table founder_notes enable row level security;

create policy "founder_notes: authenticated access"
  on founder_notes for all
  to authenticated
  using (true)
  with check (true);

alter table checklist_templates add column items jsonb;
alter table checklist_templates add column updated_at timestamp without time zone default now();
