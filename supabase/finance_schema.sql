-- ─────────────────────────────────────────────────────────────────────────────
-- MaraeHub Finance Module — Database Schema
-- Run on test project first (zfefukxaliuximizjkwa), then live (cbeenkpjpnhmtqtnjiyd)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── FINANCE_INCOME ────────────────────────────────────────────────────────────
create table if not exists finance_income (
  id          uuid          primary key default gen_random_uuid(),
  date        date          not null,
  description text          not null,
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  category    text          not null default 'Other'
                            check (category in (
                              'Booking Income','Grant Income','Koha',
                              'Hire Equipment','Fundraiser','Other'
                            )),
  reference   text,
  notes       text,
  status      text          not null default 'Confirmed'
                            check (status in ('Confirmed','Pending')),
  source_type text,
  source_id   uuid,
  created_at  timestamptz   not null default now()
);

create index if not exists idx_finance_income_date     on finance_income(date);
create index if not exists idx_finance_income_category on finance_income(category);
create index if not exists idx_finance_income_source   on finance_income(source_id);

alter table finance_income enable row level security;

create policy "finance_income: authenticated full access"
  on finance_income for all to authenticated using (true) with check (true);

-- ── FINANCE_EXPENSES ──────────────────────────────────────────────────────────
create table if not exists finance_expenses (
  id           uuid          primary key default gen_random_uuid(),
  date         date          not null,
  description  text          not null,
  amount       numeric(12,2) not null default 0 check (amount >= 0),
  category     text          not null default 'Other'
                             check (category in (
                               'Maintenance and Repairs','Utilities','Insurance',
                               'Events','Administration','Wages','Equipment','Cleaning','Other'
                             )),
  payee        text,
  reference    text,
  receipt_url  text,
  receipt_name text,
  notes        text,
  status       text          not null default 'Paid'
                             check (status in ('Paid','Pending')),
  created_at   timestamptz   not null default now()
);

create index if not exists idx_finance_expenses_date     on finance_expenses(date);
create index if not exists idx_finance_expenses_category on finance_expenses(category);

alter table finance_expenses enable row level security;

create policy "finance_expenses: authenticated full access"
  on finance_expenses for all to authenticated using (true) with check (true);

-- ── FINANCE_BUDGETS ───────────────────────────────────────────────────────────
-- One row per (financial_year, category). FY = April 1 – March 31.
-- financial_year stores the April start year (2024 = Apr 2024 – Mar 2025).
create table if not exists finance_budgets (
  id             uuid          primary key default gen_random_uuid(),
  financial_year integer       not null,
  category       text          not null,
  amount         numeric(12,2) not null default 0,
  updated_at     timestamptz,
  created_at     timestamptz   not null default now(),
  unique(financial_year, category)
);

create index if not exists idx_finance_budgets_fy on finance_budgets(financial_year);

alter table finance_budgets enable row level security;

create policy "finance_budgets: authenticated full access"
  on finance_budgets for all to authenticated using (true) with check (true);

-- ── FINANCE_BALANCE_SHEET ─────────────────────────────────────────────────────
-- Single-row table — upserted by the app. Equipment value pulled live from assets.
create table if not exists finance_balance_sheet (
  id                    uuid          primary key default gen_random_uuid(),
  cash_balance          numeric(12,2) not null default 0,
  other_assets          numeric(12,2) not null default 0,
  other_assets_notes    text,
  loans                 numeric(12,2) not null default 0,
  loans_notes           text,
  outstanding_payments  numeric(12,2) not null default 0,
  outstanding_notes     text,
  updated_at            timestamptz,
  created_at            timestamptz   not null default now()
);

alter table finance_balance_sheet enable row level security;

create policy "finance_balance_sheet: authenticated full access"
  on finance_balance_sheet for all to authenticated using (true) with check (true);

-- ── MARAE_SETTINGS — add Xero toggle ─────────────────────────────────────────
alter table marae_settings
  add column if not exists use_xero boolean not null default false;
