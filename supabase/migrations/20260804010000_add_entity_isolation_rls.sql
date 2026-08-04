-- Multi-Entity Support (ClickUp 86d3fprrb) — real database-level entity
-- isolation, replacing the "shared module + UI dropdown filter" design
-- Stage 1 originally proposed. entity_id already exists (nullable) on
-- finance_income, finance_expenses, compliance_items, and risk_register
-- (20260723000001_add_entities_table.sql) but carried zero RLS weight -
-- any trustee could already read/write every entity's rows regardless of
-- entity_id. This migration makes entity membership an actual access
-- control, not just a display filter.
--
-- Design confirmed across several rounds before writing this file:
--   1. entity_id IS NULL means whole-marae/shared data, visible to every
--      trustee regardless of entity assignment - not a gap, a deliberate
--      choice. 100% of existing rows in all 4 tables are NULL today (no
--      backfill has happened), so applying this changes nothing for
--      anyone on day one - isolation only bites on rows tagged with a
--      real entity_id going forward.
--   2. Admin trustees (profiles.trustee_role = 'admin') see every entity
--      automatically via a role check inside is_entity_member(), not a
--      wildcard assignment row - a role check has no per-entity upkeep
--      as new entities get created later.
--   3. Rollout rule for whoever assigns entity_id on real rows going
--      forward: assign the relevant trustees to the entity in
--      trustee_entities FIRST, then tag rows with that entity_id -
--      never the other way around, or the affected trustees lose
--      visibility into that entity's rows until the assignment catches up.
--
-- finance_income/finance_expenses's existing policies also only checked
-- "authenticated" (any logged-in user, including community-role), not
-- "trustee" specifically - this migration tightens that too, matching
-- the trustee-only convention already correct on compliance_items and
-- (as of the previous migration) risk_register.

-- ── TRUSTEE-TO-ENTITY ASSIGNMENT ────────────────────────────────────────────

create table if not exists trustee_entities (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  entity_id   uuid not null references entities(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (profile_id, entity_id)
);

alter table trustee_entities enable row level security;

drop policy if exists "Trustees view own assignments, admins view all" on trustee_entities;
create policy "Trustees view own assignments, admins view all"
  on trustee_entities for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin')
  );

drop policy if exists "Admin trustees manage assignments" on trustee_entities;
create policy "Admin trustees manage assignments"
  on trustee_entities for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));

-- ── MEMBERSHIP CHECK ─────────────────────────────────────────────────────────
-- security invoker deliberately - only ever sees what the calling trustee
-- can already see via trustee_entities' own RLS (their own rows), no
-- privilege escalation.

create or replace function is_entity_member(check_entity_id uuid)
returns boolean
language sql
security invoker
stable
as $$
  select check_entity_id is null
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin')
    or exists (select 1 from trustee_entities te where te.profile_id = auth.uid() and te.entity_id = check_entity_id);
$$;

-- ── ENTITY-AWARE RLS ON THE 4 STAGE 1 TABLES ────────────────────────────────

drop policy if exists "finance_income: authenticated full access" on finance_income;
drop policy if exists "Trustees can manage finance_income within their entities" on finance_income;
create policy "Trustees can manage finance_income within their entities"
  on finance_income for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(finance_income.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(finance_income.entity_id)
  );

drop policy if exists "finance_expenses: authenticated full access" on finance_expenses;
drop policy if exists "Trustees can manage finance_expenses within their entities" on finance_expenses;
create policy "Trustees can manage finance_expenses within their entities"
  on finance_expenses for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(finance_expenses.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(finance_expenses.entity_id)
  );

drop policy if exists "Trustees can manage compliance items" on compliance_items;
drop policy if exists "Trustees can manage compliance_items within their entities" on compliance_items;
create policy "Trustees can manage compliance_items within their entities"
  on compliance_items for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(compliance_items.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(compliance_items.entity_id)
  );

drop policy if exists "Trustees can manage risks" on risk_register;
drop policy if exists "Trustees can manage risk_register within their entities" on risk_register;
create policy "Trustees can manage risk_register within their entities"
  on risk_register for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(risk_register.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(risk_register.entity_id)
  );
