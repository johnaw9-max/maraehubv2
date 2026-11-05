-- Rollback for P1-09_ai_drafting_setting.sql. The app and function treat a
-- missing column as "on", so removing it re-enables AI drafting everywhere.
begin;
alter table public.marae_settings drop column if exists ai_drafting_enabled;
commit;
