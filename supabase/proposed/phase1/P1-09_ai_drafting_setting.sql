-- Phase 1, item 9 (P1-09): marae admin on/off switch for AI drafting.
-- PROPOSED — not applied anywhere. Move into supabase/migrations and apply to
-- TEST first, after John approves D-09.
--
-- Default TRUE so existing marae keep AI drafting exactly as today (the
-- per-use notice and tick box still apply). Recommended in D-09; if John
-- chooses "off by default", change the default and the update below to false.
--
-- Safe to apply before or after the app/function change: both treat a
-- missing column as "on", and the Settings switch stays hidden until the
-- column exists.
begin;
alter table public.marae_settings
  add column if not exists ai_drafting_enabled boolean not null default true;
comment on column public.marae_settings.ai_drafting_enabled is
  'Phase 1 P1-09: when false, Draft from Hui Notes is hidden and draft-minutes refuses requests.';
commit;
