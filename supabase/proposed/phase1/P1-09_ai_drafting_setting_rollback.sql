-- Rollback for P1-09_ai_drafting_setting.sql. The app and function treat a
-- missing column as OFF, so removing it hides AI drafting everywhere.
begin;
alter table public.marae_settings drop column if exists ai_drafting_enabled;
commit;
