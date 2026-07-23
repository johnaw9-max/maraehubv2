-- Multi-Entity Support, subtask 2 (ClickUp 86d3t5fth): adds an entities
-- table for a marae's sub-entities (e.g. kōhanga reo, trust arms) and a
-- nullable entity_id column on finance_income, finance_expenses,
-- compliance_items, and risk_register.
--
-- entity_id is deliberately nullable for now, not required with a default
-- entity - backfilling existing rows and tightening to NOT NULL is planned
-- as a separate, later migration once these columns are confirmed stable,
-- matching ClickUp's own subtask 3. Keeping this migration to simple
-- additive DDL only (no backfill, no constraint tightening) minimizes the
-- surface area for the kind of unexplained migration failure found earlier
-- this session (20260624_service_reminder_auto_workflow.sql - marked
-- applied, correct DDL stored, column never actually existed, root cause
-- undetermined).
--
-- No marae-scoping column on entities: confirmed by checking the full
-- schema that finance_income/finance_expenses/compliance_items/
-- risk_register (the tables entity_id is added to) have no tenant/marae
-- column anywhere - each Supabase project holds exactly one marae's data
-- for this category of table. (Not a universal schema property: founder_notes
-- does hold multi-marae data via marae_name, but that's a founder-level
-- table, a different category from these four.)
--
-- All statements below are safe to re-run: this file already ran once
-- (table + columns created) before RLS was added in a second pass, so
-- every statement is guarded to be idempotent.

create table if not exists entities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table finance_income   add column if not exists entity_id uuid references entities(id) on delete restrict;
alter table finance_expenses add column if not exists entity_id uuid references entities(id) on delete restrict;
alter table compliance_items add column if not exists entity_id uuid references entities(id) on delete restrict;
alter table risk_register    add column if not exists entity_id uuid references entities(id) on delete restrict;

alter table entities enable row level security;

drop policy if exists "Trustees can manage entities" on entities;
create policy "Trustees can manage entities"
  on entities for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'));
