-- Add ai_drafting_enabled toggle to marae_settings (D-09 consent gate)
alter table public.marae_settings
  add column if not exists ai_drafting_enabled boolean not null default false;
