-- Finance Balance Sheet v2 — add investments and other liabilities
-- Run on test first (zfefukxaliuximizjkwa), then live (cbeenkpjpnhmtqtnjiyd)

alter table finance_balance_sheet
  add column if not exists investments_term_deposits  numeric(12,2) not null default 0,
  add column if not exists investments_shares         numeric(12,2) not null default 0,
  add column if not exists investments_property       numeric(12,2) not null default 0,
  add column if not exists investments_other          numeric(12,2) not null default 0,
  add column if not exists investments_notes          text,
  add column if not exists accounts_payable           numeric(12,2) not null default 0,
  add column if not exists accounts_payable_notes     text,
  add column if not exists other_liabilities          numeric(12,2) not null default 0,
  add column if not exists other_liabilities_notes    text;
