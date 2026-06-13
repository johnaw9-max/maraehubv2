-- Add investment fields to finance_balance_sheet
ALTER TABLE finance_balance_sheet
  ADD COLUMN IF NOT EXISTS term_deposits         NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_bonds          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS property_investments  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_investments     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS investments_notes     TEXT;
