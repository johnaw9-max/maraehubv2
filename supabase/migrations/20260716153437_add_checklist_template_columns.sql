-- checklist_templates existed on live projects with only id/items/updated_at —
-- never matched the label/sort_order/active/created_at shape the app expects
-- (no prior migration ever created this table). Adds the missing columns.

alter table checklist_templates
  add column if not exists label text not null,
  add column if not exists sort_order integer not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();
