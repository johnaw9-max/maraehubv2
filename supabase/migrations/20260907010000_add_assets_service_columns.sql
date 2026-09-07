-- Real environment drift found via check-deadlines' schema drift check
-- (ClickUp 86d3u7790, Stage 2d): the test project's `assets` table was
-- missing `last_service`/`next_service`, both already live on Opeke and
-- already documented in schema.sql. No prior migration ever created these
-- columns -- they predate this repo's migration-file discipline on Opeke.
-- Guarded with IF NOT EXISTS so this is a no-op if ever run on Opeke.

alter table assets add column if not exists last_service date;
alter table assets add column if not exists next_service date;
