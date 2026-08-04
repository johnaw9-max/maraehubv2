-- Closes ClickUp 86d3wrnxv: Opeke is missing risk_register.trustee_id and
-- booking_feedback.user_id, both of which Tineka has. Confirmed via
-- information_schema on both projects that these are real, intentional
-- FK-shaped columns (used by Stage 2a's orphaned-records check), not
-- Tineka-only drift that should instead be removed from the check.
-- Both nullable with no default on Tineka, so adding them here is a
-- no-op for every existing Opeke row (all become NULL) - no backfill.

alter table risk_register
  add column if not exists trustee_id uuid references auth.users(id);

alter table booking_feedback
  add column if not exists user_id uuid references auth.users(id) on delete set null;
