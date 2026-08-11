-- Found via Stage 2d's schema_drift check (ClickUp 86d3u7790) on its first
-- real Tineka run: booking_feedback and booking_checklists have genuinely
-- diverged column names between Opeke and Tineka, not just stale
-- schema.sql documentation.
--
-- Confirmed pre-existing, not caused by tonight's work: zero commits since
-- 2026-08-09 touch either table (git log --name-only), and both
-- BookingFeedback.js / BookingChecklist.js were last changed in their
-- original commit, fd293bf, 2026-06-05 -- the app code has used these
-- column names for over two months. Tineka's rename has no migration file
-- anywhere -- applied via untracked direct SQL at some undetermined past
-- point, same pattern as this project's other known migration-tracking
-- drift. Opeke was simply never migrated to match.
--
-- Real, confirmed impact on Opeke (real production): both features would
-- fail on submit, since the app writes to column names that do not exist
-- there. Both tables confirmed empty on Opeke (0 rows) before this
-- migration -- zero data-loss risk either way, which is why this renames
-- in place rather than adding new columns alongside the old: nothing to
-- preserve, and renaming leaves no dead/duplicate columns behind.
--
-- Scoped to column names only, matching what was asked. Opeke's timestamp
-- columns are `timestamp without time zone`, Tineka's equivalents are
-- `timestamp with time zone` -- that mismatch is untouched here,
-- deliberately logged as its own separate follow-up task rather than
-- folded into this migration.
--
-- Idempotent: each rename is guarded by an information_schema check, so
-- running this on a project that already has the correct names (e.g.
-- Tineka) is a safe no-op.

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'booking_feedback' and column_name = 'rating') then
    alter table booking_feedback rename column rating to rating_overall;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'booking_feedback' and column_name = 'cleanliness') then
    alter table booking_feedback rename column cleanliness to rating_cleanliness;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'booking_feedback' and column_name = 'facilities') then
    alter table booking_feedback rename column facilities to rating_facilities;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'booking_feedback' and column_name = 'overall_experience') then
    alter table booking_feedback rename column overall_experience to experience;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'booking_feedback' and column_name = 'submitted_at') then
    alter table booking_feedback rename column submitted_at to created_at;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'booking_checklists' and column_name = 'checklist_items') then
    alter table booking_checklists rename column checklist_items to items;
  end if;
end $$;

alter table booking_checklists add column if not exists completed boolean not null default false;

update booking_checklists set completed = true where completed_at is not null and completed = false;
