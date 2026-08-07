-- Urgent security fix, Phase 1 of the Minutes entity-isolation work
-- (ClickUp 86d3fprrb). Found during discovery for the Minutes migration,
-- fixed immediately and separately rather than bundled into the larger
-- Phase 2 change.
--
-- interest_register's existing policy was role={public}, USING(true) -
-- full read/write/delete access with NO LOGIN REQUIRED AT ALL, on both
-- Tineka and Ōpeke. Same severity class as the risk_register
-- vulnerability fixed in 20260804000000_fix_risk_register_public_rls.sql.
--
-- interest_register is genuinely standalone (no meeting_id, no FK to any
-- other entity-aware table - confirmed by direct schema check), so it
-- gets its own entity_id column directly, same as meetings will in
-- Phase 2. CommitteeMinutes.js (the only consumer of this table) is
-- trustee-only - confirmed by direct check, only ever imported by
-- TrusteeDashboard.js, never CommunityPortal.js - so no community-access
-- path needs preserving here, unlike bookings.
--
-- Policy naming: four separate per-verb policies (select/insert/update/
-- delete) rather than this project's usual single `for all` policy -
-- a deliberate, explicitly-approved departure from the convention used
-- on every other entity-aware table (compliance_items, risk_register,
-- finance_income, finance_expenses, bookings, assets, documents), which
-- all use one `for all` policy. Functionally equivalent given identical
-- conditions across all four verbs here; the split is a maintainability
-- preference, not a correctness requirement. This naming convention
-- (<table>_select/_insert/_update/_delete) is intended to be the
-- template for the Phase 2 Minutes migration that follows.

alter table interest_register add column if not exists entity_id uuid references entities(id) on delete restrict;

drop policy if exists "Trustees can manage interest register" on interest_register;
drop policy if exists "interest_register_select" on interest_register;
drop policy if exists "interest_register_insert" on interest_register;
drop policy if exists "interest_register_update" on interest_register;
drop policy if exists "interest_register_delete" on interest_register;

create policy "interest_register_select" on interest_register for select
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(interest_register.entity_id)
  );

create policy "interest_register_insert" on interest_register for insert
  to authenticated
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(interest_register.entity_id)
  );

create policy "interest_register_update" on interest_register for update
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(interest_register.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(interest_register.entity_id)
  );

create policy "interest_register_delete" on interest_register for delete
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(interest_register.entity_id)
  );
