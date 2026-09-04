-- Finance module: real data-model gaps closed ahead of a future "export for
-- your accountant" feature (audited this session -- see chat history, not a
-- ClickUp task yet). Four real gaps, no export logic built here, data model
-- only.

-- ── GST ──────────────────────────────────────────────────────────────────
-- amount keeps its current meaning (GST-inclusive, unchanged -- no breaking
-- change to anything already entered). gst_amount is the GST component
-- within that total; GST-exclusive is always (amount - gst_amount), derived
-- at export time, never stored, so the three numbers can't drift apart.
--
-- Deliberately nullable, no default: every existing row becomes
-- gst_amount = null, meaning "not yet reviewed for GST" -- honestly
-- distinct from a confirmed 0 (e.g. koha, wages -- genuinely no GST
-- component). Defaulting to 0 would have silently asserted "confirmed no
-- GST" for years of historical data we actually know nothing about.

alter table marae_settings
  add column gst_registered boolean not null default false;

alter table finance_income
  add column gst_amount numeric;
alter table finance_income
  add constraint finance_income_gst_amount_check
  check (gst_amount is null or (gst_amount >= 0 and gst_amount <= amount));

alter table finance_expenses
  add column gst_amount numeric;
alter table finance_expenses
  add constraint finance_expenses_gst_amount_check
  check (gst_amount is null or (gst_amount >= 0 and gst_amount <= amount));

-- ── PAYER on finance_income ─────────────────────────────────────────────
-- Exact mirror of finance_expenses.payee -- expenses know who was paid,
-- income had no equivalent for who paid the marae.

alter table finance_income
  add column payer text;

-- ── RECEIPT on finance_income ───────────────────────────────────────────
-- Exact mirror of finance_expenses.receipt_url / receipt_name.

alter table finance_income
  add column receipt_url text;
alter table finance_income
  add column receipt_name text;

-- ── FINANCE_OPENING_BALANCES ────────────────────────────────────────────
-- Real, stored opening balance per financial year -- replaces
-- printGeneralLedger()'s hardcoded openingBalance = 0. One row per FY,
-- org-wide, matching finance_balance_sheet's existing "whole organisation,
-- not per entity" simplification (already disclosed on the AGM report
-- itself), not a new inconsistency.
--
-- Deliberately no seed row for the current FY: absence of a row means "not
-- yet set" to the app (prompt to enter it), not an implied zero -- seeding
-- 0 here would just quietly recreate the exact hardcoded assumption this
-- migration exists to fix. Populating it is a Step 2 app-logic decision.

create table if not exists finance_opening_balances (
  id uuid not null default gen_random_uuid(),
  financial_year integer not null,
  opening_balance numeric not null default 0,
  notes text,
  set_by text,
  set_at timestamp with time zone not null default now()
);

alter table finance_opening_balances add constraint finance_opening_balances_pkey PRIMARY KEY (id);
alter table finance_opening_balances add constraint finance_opening_balances_financial_year_key UNIQUE (financial_year);

alter table finance_opening_balances enable row level security;

-- Same admin-trustee-only shape as finance_budgets / finance_balance_sheet
-- (20260829000000_restrict_finance_to_admin_trustees.sql) -- this is
-- finance data and should never default to open "authenticated full
-- access".
create policy "Admin trustees can manage finance_opening_balances"
  on finance_opening_balances for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));
