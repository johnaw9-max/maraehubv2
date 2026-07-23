-- Fixes compliance_items RLS: any authenticated user (including community-role
-- accounts, not just trustees) currently has full read/write/delete access,
-- unlike risk_register which already restricts to trustees via an EXISTS
-- check against profiles.role. Original policy left in place (see pointer
-- comment in 20260611084210_create_compliance_tables.sql) rather than edited
-- in place, since that migration is already recorded as applied.

drop policy "compliance_items: authenticated full access" on compliance_items;

create policy "Trustees can manage compliance items"
  on compliance_items for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'));
