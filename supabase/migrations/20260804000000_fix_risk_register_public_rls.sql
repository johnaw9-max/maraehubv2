-- URGENT SECURITY FIX: risk_register's "Trustees can manage risks" policy
-- was found live on Tineka today (2026-08-04) still granted to `public`
-- with USING(true)/WITH CHECK(true) - meaning any request, including a
-- completely unauthenticated one, has full read/write/delete access to
-- the entire risk register. ClickUp 86d3fprrb records this as "Fixed
-- live (20 July)" - confirmed directly via pg_policies that the fix was
-- applied to Opeke only and never landed on Tineka, and was never
-- captured in a committed migration on either project, so git had no
-- record to catch the drift.
--
-- This migration makes Tineka match Opeke's already-correct live policy
-- exactly: authenticated role only, USING/WITH CHECK requiring a
-- profiles row with role = 'trustee', same convention already used by
-- compliance_items (20260723000000_fix_compliance_items_rls.sql) and by
-- public-booking-request/index.ts at the app layer.
--
-- Scoped to this one fix only - unrelated to the entity-isolation work
-- also in progress on 86d3fprrb.

drop policy if exists "Trustees can manage risks" on risk_register;

create policy "Trustees can manage risks"
  on risk_register for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'));
