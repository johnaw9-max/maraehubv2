-- Multi-Entity Support (ClickUp 86d3fprrb) — extends real database-level
-- entity isolation from finance_income/finance_expenses/compliance_items/
-- risk_register (20260804010000_add_entity_isolation_rls.sql) to bookings,
-- assets, and documents. Minutes (meetings/resolutions/meeting_actions/
-- interest_register) checked and confirmed to have the same gap, but
-- deliberately deferred to a later pass, not included here.
--
-- Real, live finding independent of entity work: all three tables
-- currently carry a leftover "authenticated full access" policy
-- (USING(true)/WITH CHECK(true)) — any logged-in user, any role, has
-- full read/write/delete on every row. The community-member restriction
-- assumed by the UI (BookingsManager.js filtering to `user_id = userId`
-- when !isTrustee) is application-layer only, not enforced by RLS at
-- all — the same class of gap as the risk_register fix in
-- 20260804000000_fix_risk_register_public_rls.sql. This migration closes
-- it as part of making these tables entity-aware, since the permissive
-- policy has to be replaced either way.
--
-- assets and documents are trustee-only in practice: checked directly,
-- AssetsManager.js/DocumentsManager.js are only ever imported by
-- TrusteeDashboard.js, never CommunityPortal.js. Same shape as
-- compliance_items/risk_register: role='trustee' AND is_entity_member().
--
-- bookings is genuinely different and needs a two-path policy:
-- BookingsManager.js is rendered on BOTH the trustee side (isTrustee=true)
-- and the community side (isTrustee=false, userId=profile.id), and
-- BookingWizard.js (community booking creation) inserts with
-- user_id: profile.id. Community members cannot read the entities table
-- at all (its policy is role='trustee'), so gating bookings the same way
-- as the trustee-only tables would break community members' ability to
-- see or create their own bookings entirely. The policy below instead
-- OR's two independent paths: trustees get the entity-aware path
-- (matching every other table), community members keep unconditional
-- access to rows where user_id = auth.uid(), completely independent of
-- entity_id. Traced both existing trustee flows against this before
-- writing it: the trustee "Add Booking" form inserts user_id: null
-- (passes via the trustee branch, entity_id defaults to shared/null,
-- is_entity_member(null) = true); a trustee approving/declining a
-- community member's booking updates a row whose user_id isn't theirs
-- (also passes via the trustee branch, since that branch never checks
-- user_id).
--
-- is_entity_member() already exists from the original migration and is
-- fully generic (takes any check_entity_id, not tied to specific
-- tables) — reused as-is here, no changes needed.
--
-- entity_id is nullable, no backfill, same as the original 4 tables:
-- entity_id IS NULL means whole-marae/shared data, visible to every
-- trustee regardless of entity assignment. All existing rows in all 3
-- tables are NULL today, so this changes nothing for anyone on day one.

-- ── ADD entity_id TO THE 3 NEW TABLES ───────────────────────────────────────

alter table bookings  add column if not exists entity_id uuid references entities(id) on delete restrict;
alter table assets    add column if not exists entity_id uuid references entities(id) on delete restrict;
alter table documents add column if not exists entity_id uuid references entities(id) on delete restrict;

-- ── ENTITY-AWARE RLS: assets, documents (trustee-only, same shape as
--    compliance_items/risk_register) ────────────────────────────────────────

drop policy if exists "assets: authenticated full access" on assets;
drop policy if exists "Trustees can manage assets within their entities" on assets;
create policy "Trustees can manage assets within their entities"
  on assets for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(assets.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(assets.entity_id)
  );

drop policy if exists "documents: authenticated full access" on documents;
drop policy if exists "Trustees can manage documents within their entities" on documents;
create policy "Trustees can manage documents within their entities"
  on documents for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(documents.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(documents.entity_id)
  );

-- ── ENTITY-AWARE RLS: bookings (two paths — trustees within their
--    entities, OR the community member who owns the booking) ──────────────

drop policy if exists "bookings: authenticated full access" on bookings;
drop policy if exists "Trustees within entity or own bookings" on bookings;
create policy "Trustees within entity or own bookings"
  on bookings for all
  to authenticated
  using (
    (
      exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
      and is_entity_member(bookings.entity_id)
    )
    or bookings.user_id = auth.uid()
  )
  with check (
    (
      exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
      and is_entity_member(bookings.entity_id)
    )
    or bookings.user_id = auth.uid()
  );
