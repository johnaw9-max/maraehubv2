-- Phase 1, item 9 (P1-09): marae admin on/off switch for AI drafting.
-- PROPOSED — not applied anywhere. Move into supabase/migrations and apply to
-- TEST first, after John approves D-09.
--
-- D-09 decided by John Williams, 5 Nov 2026: OPT-IN. Default FALSE for
-- existing and new marae; each marae admin must explicitly turn it on.
-- The per-use notice and tick box still apply when it is on.
--
-- The app and draft-minutes treat a missing column as OFF, so the AI option
-- is hidden on any project where this has not been applied. The Settings
-- switch only appears once this column exists.
begin;
alter table public.marae_settings
  add column if not exists ai_drafting_enabled boolean not null default false;
comment on column public.marae_settings.ai_drafting_enabled is
  'Phase 1 P1-09: when false, Draft from Hui Notes is hidden and draft-minutes refuses requests.';
commit;
