-- Multi-Entity Support, Phase 2 of the Minutes work (ClickUp 86d3fprrb).
-- Extends real database-level entity isolation to meetings, resolutions,
-- and meeting_actions. interest_register was fixed separately and
-- urgently in Phase 1 (20260807020000_fix_interest_register_public_rls.sql)
-- since it carried an unauthenticated public-access hole; this migration
-- is the remaining, non-urgent structural work.
--
-- Design principle: single source of truth, no duplicated entity_id.
-- meetings gets its own entity_id. resolutions and meeting_actions do
-- NOT get their own entity_id column - both belong to exactly one
-- meeting (confirmed: every insert in CommitteeMinutes.js sets
-- meeting_id, and meeting_id now becomes NOT NULL below), so their
-- visibility is derived from their parent meeting via a join, not a
-- second, independently-taggable column that could drift out of sync
-- with the meeting it actually belongs to.
--
-- meeting_id NOT NULL: checked real data on both projects before adding
-- this - Tineka has 0 resolutions/meeting_actions, Opeke has 10
-- resolutions and 4 meeting_actions, and NONE of Opeke's real rows have
-- a null meeting_id. Safe on both. Beyond data safety, this closes a
-- real privacy risk: under the inheritance design, a null meeting_id
-- resolves to "shared, visible to every trustee across every entity"
-- (is_entity_member(NULL) = true). If meeting_id stayed nullable, a
-- future bug that accidentally omitted it on insert wouldn't just
-- create an orphaned row - it would silently leak that resolution or
-- action marae-wide across entity boundaries, with no error raised.
-- NOT NULL makes that state structurally impossible rather than merely
-- handled gracefully.
--
-- CommitteeMinutes.js (the only consumer of all three tables) is
-- trustee-only, confirmed directly - only ever imported by
-- TrusteeDashboard.js, never CommunityPortal.js. No community-access
-- path to preserve here, unlike bookings.
--
-- Policy naming: four per-verb policies per table
-- (<table>_select/_insert/_update/_delete), matching the convention
-- established in Phase 1's interest_register migration. A deliberate,
-- explicitly-approved departure from this project's usual single
-- `for all` policy - functionally equivalent given identical conditions
-- across all four verbs in every one of these policies.
--
-- Old-policy cleanup defensively covers BOTH known name variants found
-- on the two projects (Tineka: "<table>: authenticated full access";
-- Ōpeke: "allow_authenticated") - the exact lesson from the stray-policy
-- bug found and fixed during the bookings/assets/documents migration
-- earlier this session, applied proactively here instead of discovered
-- by a failing test.
--
-- get_meeting_entity_id(): a real bug found via actual behavioral
-- testing against Tineka, not assumed. The first version of this
-- migration used a plain subquery (select m.entity_id from meetings m
-- where m.id = resolutions.meeting_id) inside resolutions'/
-- meeting_actions' policies. That subquery is itself subject to
-- meetings' own RLS policy, evaluated as the same calling trustee -
-- so for a trustee who genuinely can't see the meeting, the subquery
-- returns zero rows (NULL), and is_entity_member(NULL) = true (the
-- "shared" fallback) - meaning a meeting the trustee can't see gets
-- treated as untagged/shared, backwards from the intended isolation.
-- This is RLS-on-RLS recursion: using a referenced table's own
-- visibility to decide access to a row that depends on that same
-- visibility is circular. Fixed with a narrow SECURITY DEFINER
-- function that reads only a meeting's entity_id (nothing else),
-- bypassing RLS deliberately and safely for that single, narrow read -
-- it exposes one UUID for an already-known meeting_id, not open-ended
-- meeting content.

-- ── SCHEMA ───────────────────────────────────────────────────────────────────

alter table meetings add column if not exists entity_id uuid references entities(id) on delete restrict;

alter table resolutions alter column meeting_id set not null;
alter table meeting_actions alter column meeting_id set not null;

-- ── HELPER: read a meeting's entity_id, bypassing meetings' own RLS ─────────
-- (see the get_meeting_entity_id note above for why this is necessary)

create or replace function get_meeting_entity_id(check_meeting_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select entity_id from meetings where id = check_meeting_id;
$$;

-- ── DROP OLD POLICIES (both known name variants) ────────────────────────────

drop policy if exists "meetings: authenticated full access" on meetings;
drop policy if exists "allow_authenticated" on meetings;
drop policy if exists "meetings_select" on meetings;
drop policy if exists "meetings_insert" on meetings;
drop policy if exists "meetings_update" on meetings;
drop policy if exists "meetings_delete" on meetings;

drop policy if exists "resolutions: authenticated full access" on resolutions;
drop policy if exists "allow_authenticated" on resolutions;
drop policy if exists "resolutions_select" on resolutions;
drop policy if exists "resolutions_insert" on resolutions;
drop policy if exists "resolutions_update" on resolutions;
drop policy if exists "resolutions_delete" on resolutions;

drop policy if exists "meeting_actions: authenticated full access" on meeting_actions;
drop policy if exists "allow_authenticated" on meeting_actions;
drop policy if exists "meeting_actions_select" on meeting_actions;
drop policy if exists "meeting_actions_insert" on meeting_actions;
drop policy if exists "meeting_actions_update" on meeting_actions;
drop policy if exists "meeting_actions_delete" on meeting_actions;

-- ── MEETINGS (direct entity check) ──────────────────────────────────────────

create policy "meetings_select" on meetings for select
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(meetings.entity_id)
  );

create policy "meetings_insert" on meetings for insert
  to authenticated
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(meetings.entity_id)
  );

create policy "meetings_update" on meetings for update
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(meetings.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(meetings.entity_id)
  );

create policy "meetings_delete" on meetings for delete
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(meetings.entity_id)
  );

-- ── RESOLUTIONS (inherited via join to parent meeting - no entity_id of its own) ──

create policy "resolutions_select" on resolutions for select
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(resolutions.meeting_id))
  );

create policy "resolutions_insert" on resolutions for insert
  to authenticated
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(resolutions.meeting_id))
  );

create policy "resolutions_update" on resolutions for update
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(resolutions.meeting_id))
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(resolutions.meeting_id))
  );

create policy "resolutions_delete" on resolutions for delete
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(resolutions.meeting_id))
  );

-- ── MEETING_ACTIONS (identical shape to resolutions) ────────────────────────

create policy "meeting_actions_select" on meeting_actions for select
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(meeting_actions.meeting_id))
  );

create policy "meeting_actions_insert" on meeting_actions for insert
  to authenticated
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(meeting_actions.meeting_id))
  );

create policy "meeting_actions_update" on meeting_actions for update
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(meeting_actions.meeting_id))
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(meeting_actions.meeting_id))
  );

create policy "meeting_actions_delete" on meeting_actions for delete
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(get_meeting_entity_id(meeting_actions.meeting_id))
  );
