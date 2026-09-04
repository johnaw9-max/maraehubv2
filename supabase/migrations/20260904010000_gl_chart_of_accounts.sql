-- General Ledger, Stage 2 Step 1 (ClickUp 14yhc7knyea) -- real chart of
-- accounts schema + seed data. Gated on Nikki Liu's professional
-- confirmation that a genuine ledger is needed, not the CSV export alone.
-- Purely additive: a new, empty-of-transactions table sitting alongside
-- everything already shipped in the Finance accountant-export work
-- (Steps 1-4). Nothing existing changes or breaks.
--
-- Numbering follows Xero's real ANZ default ranges (sourced, not
-- guessed -- see ClickUp 14yhc7knyea for citations): 200s Revenue,
-- 300s Expense, 600s Asset, 800s Liability, 900s Equity. Spacing within
-- each range (increments of 10) is a MaraeHub choice, not itself sourced.
--
-- One shared chart of accounts, deliberately no entity_id -- matches how
-- Xero itself works (accounts aren't duplicated per Tracking Category; a
-- dimension is tagged onto the transaction instead). Entity-level
-- reporting, if ever needed under the real GL, belongs on
-- gl_journal_lines in Step 3, not as a fork of the account list.

create table if not exists gl_accounts (
  id uuid not null default gen_random_uuid(),
  code integer not null,
  name text not null,
  account_type text not null,
  normal_balance text not null,
  description text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table gl_accounts add constraint gl_accounts_pkey PRIMARY KEY (id);
alter table gl_accounts add constraint gl_accounts_code_key UNIQUE (code);

alter table gl_accounts add constraint gl_accounts_account_type_check
  CHECK (account_type = ANY (ARRAY['Revenue', 'Expense', 'Asset', 'Liability', 'Equity']));

-- Real accounting rule, enforced not just seeded: Asset/Expense accounts
-- carry a Debit normal balance, Liability/Equity/Revenue carry Credit.
alter table gl_accounts add constraint gl_accounts_normal_balance_check
  CHECK (normal_balance = (CASE WHEN account_type IN ('Asset', 'Expense') THEN 'Debit' ELSE 'Credit' END));

-- Code must fall in the right range for its declared type -- catches a
-- future mistaken insert at the schema level, not just at review time.
alter table gl_accounts add constraint gl_accounts_code_range_check
  CHECK (
    (account_type = 'Revenue'   AND code BETWEEN 200 AND 299) OR
    (account_type = 'Expense'   AND code BETWEEN 300 AND 499) OR
    (account_type = 'Asset'     AND code BETWEEN 600 AND 799) OR
    (account_type = 'Liability' AND code BETWEEN 800 AND 899) OR
    (account_type = 'Equity'    AND code BETWEEN 900 AND 999)
  );

CREATE INDEX idx_gl_accounts_account_type ON public.gl_accounts USING btree (account_type);

alter table gl_accounts enable row level security;

-- Same admin-trustee-only shape as finance_budgets / finance_balance_sheet
-- / finance_opening_balances -- this is finance data, never open access.
create policy "Admin trustees can manage gl_accounts"
  on gl_accounts for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));

-- ── SEED DATA ────────────────────────────────────────────────────────────
-- 14 of 15 existing finance_income/finance_expenses categories map 1:1 by
-- name to an account here, for an obvious mapping when Step 3 (auto-
-- posting) is built. The one deliberate exception: "Equipment" does NOT
-- get a 300s Expense account -- it's covered by 620 Equipment & Assets,
-- since equipment purchases post to an Asset account under real
-- double-entry, not an Expense (the Operating/Capital grouping already
-- shipped in Step 2 of the CSV-export work becoming structurally real,
-- not just a report label).

insert into gl_accounts (code, name, account_type, normal_balance, description) values
  -- Revenue (200s) -- matches INCOME_CATEGORIES
  (200, 'Booking Income',          'Revenue', 'Credit', null),
  (210, 'Grant Income',            'Revenue', 'Credit', null),
  (220, 'Koha',                    'Revenue', 'Credit', null),
  (230, 'Hire Equipment',          'Revenue', 'Credit', null),
  (240, 'Fundraiser',              'Revenue', 'Credit', null),
  (260, 'Other Income',            'Revenue', 'Credit', null),

  -- Expenses (300s) -- matches EXPENSE_CATEGORIES minus Equipment
  (300, 'Maintenance and Repairs', 'Expense', 'Debit', null),
  (310, 'Utilities',               'Expense', 'Debit', null),
  (320, 'Insurance',               'Expense', 'Debit', null),
  (330, 'Events',                  'Expense', 'Debit', null),
  (340, 'Administration',          'Expense', 'Debit', null),
  (350, 'Cleaning',                'Expense', 'Debit', null),
  (360, 'Other Expenses',          'Expense', 'Debit', null),
  (400, 'Wages',                   'Expense', 'Debit', null),

  -- Assets (600s)
  (600, 'Bank - Cheque Account',   'Asset', 'Debit', null),
  (610, 'Bank - Savings Account',  'Asset', 'Debit', null),
  (620, 'Equipment & Assets',      'Asset', 'Debit', 'Capitalised equipment purchases -- mirrors the Assets Register, replaces the old Equipment expense category under double-entry'),
  (630, 'Term Deposits',           'Asset', 'Debit', null),
  (640, 'Property & Investments',  'Asset', 'Debit', null),
  (650, 'Accounts Receivable',     'Asset', 'Debit', null),

  -- Liabilities (800s)
  (800, 'Accounts Payable',        'Liability', 'Credit', null),
  (810, 'Loans',                   'Liability', 'Credit', null),
  (820, 'GST Payable',             'Liability', 'Credit', null),

  -- Equity (900s)
  (900, 'Accumulated Funds',       'Equity', 'Credit', null),
  (910, 'Current Year Earnings',   'Equity', 'Credit', null);
