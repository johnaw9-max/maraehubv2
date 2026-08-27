-- ClickUp 86d45fub4, F.3: links a Meeting Action back to the Resolution
-- (decision) it arose from -- the one schema change in the Automation
-- Engine audit's implementation plan (section D.3/F.3). Nullable and
-- additive, same pattern as documents.charter_fields (20260826000000)
-- -- existing rows are entirely unaffected, and most actions will never
-- set this (only ones created directly from a Resolution via the future
-- "+ Add Action from this decision" shortcut, F.4, not yet built).
-- ON DELETE SET NULL rather than CASCADE: deleting a resolution should
-- detach its actions, not delete them -- the action itself is still real
-- work that needs doing regardless of whether the originating decision
-- record still exists.

alter table public.meeting_actions
  add column resolution_id uuid references public.resolutions(id) on delete set null;
