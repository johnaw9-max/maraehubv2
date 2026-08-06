-- Follow-up fix to 20260807000000_add_entity_isolation_bookings_assets_documents.sql.
--
-- Real bug found during Opeke's behavioral testing, not assumed: the
-- negative test (unassigned standard trustee should see 0 rows) returned
-- 1 for assets/documents/bookings instead of 0. Investigated directly -
-- Opeke's bookings/assets/documents carried a differently-named leftover
-- permissive policy, "allow_authenticated" (USING(true)), not
-- "<table>: authenticated full access" like Tineka. The prior migration's
-- `drop policy if exists "<table>: authenticated full access"` only
-- matched Tineka's exact name, so it silently didn't drop this one on
-- Opeke - Postgres OR's multiple permissive policies together, so the
-- old blanket-access policy kept winning underneath the new entity-aware
-- one.
--
-- Checked before writing this fix: the original 4 tables
-- (finance_income/finance_expenses/compliance_items/risk_register) do
-- NOT have this same drift on Opeke - each has exactly one, correct,
-- entity-aware policy. This is isolated to the 3 new tables only, not a
-- pre-existing gap in the 4 August work.
--
-- Safe to re-run anywhere: `drop policy if exists` is a no-op wherever
-- "allow_authenticated" doesn't exist (e.g. Tineka, confirmed directly
-- to not have it).

drop policy if exists "allow_authenticated" on bookings;
drop policy if exists "allow_authenticated" on assets;
drop policy if exists "allow_authenticated" on documents;
