-- Stores the trustee's one-time CSV column mapping for bank reconciliation
-- (which column is Date/Amount/Description, date format, single-Amount vs
-- separate Debit/Credit columns). Single-tenant app, so this lives on the
-- one marae_settings row rather than a new table.

alter table marae_settings
  add column if not exists bank_csv_mapping jsonb;
