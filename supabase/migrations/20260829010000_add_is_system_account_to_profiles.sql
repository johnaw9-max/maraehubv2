-- ClickUp 86d3u7790, Stage 5 item 1: marks profiles created purely for
-- internal system checks (e.g. the daily synthetic login-health check
-- being added in this same change) so they can be reliably excluded from
-- every trustee/community-facing list and from future checks (e.g. the
-- planned adoption-gap check, item 2) without relying on name-pattern
-- matching. Same precedent as the existing is_fire_warden boolean on
-- this table -- a plain flag, not inferred from a naming convention.
--
-- Nullable-safe additive change: not null with a default, so every
-- existing row is unaffected and reads as false (a real person, not a
-- system account) without a backfill step.

alter table public.profiles
  add column is_system_account boolean not null default false;
