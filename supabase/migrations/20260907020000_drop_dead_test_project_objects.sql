-- Cleanup of dead objects found only on the test project via
-- check-deadlines' schema drift check (ClickUp 86d3u7790, Stage 2d).
-- None of these exist on Opeke, none are referenced anywhere in
-- migrations or src/, and adding them to schema.sql instead would have
-- just made Opeke start failing this same check.
--
-- project_subtasks: 0 rows, zero references in src/ or any migration --
-- an orphaned table, never part of a shipped feature.
--
-- finance_balance_sheet.investments_term_deposits/investments_shares/
-- investments_property/investments_other: an old naming scheme,
-- superseded by term_deposits/shares_bonds/property_investments/
-- other_investments -- the names actually used by FinanceManager.js and
-- already in schema.sql.
--
-- finance_balance_sheet.accounts_payable/accounts_payable_notes/
-- other_liabilities/other_liabilities_notes: zero references anywhere in
-- src/ or migrations, never existed on Opeke.
--
-- Guarded with IF EXISTS so this is a no-op if ever run on Opeke.

drop table if exists project_subtasks;

alter table finance_balance_sheet drop column if exists investments_term_deposits;
alter table finance_balance_sheet drop column if exists investments_shares;
alter table finance_balance_sheet drop column if exists investments_property;
alter table finance_balance_sheet drop column if exists investments_other;
alter table finance_balance_sheet drop column if exists accounts_payable;
alter table finance_balance_sheet drop column if exists accounts_payable_notes;
alter table finance_balance_sheet drop column if exists other_liabilities;
alter table finance_balance_sheet drop column if exists other_liabilities_notes;
