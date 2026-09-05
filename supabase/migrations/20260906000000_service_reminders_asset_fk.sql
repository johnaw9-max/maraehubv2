-- Real root-cause fix for 86d3wreta ("Could not find a relationship
-- between service_reminders and assets in the schema cache"), first
-- found 2 Aug 2026. Confirmed by direct information_schema query, not
-- assumed: this was never a stale-PostgREST-cache issue -- Opeke's
-- service_reminders.asset_id genuinely had no foreign key constraint at
-- all, only a primary key. The test project already has this exact FK
-- (service_reminders_asset_id_fkey, ON DELETE CASCADE), confirming real
-- environment drift between the two projects, not a code-level gap.
-- Zero orphaned asset_id values found on Opeke before writing this --
-- safe to add without any data cleanup first.
--
-- Guarded with a existence check (not IF NOT EXISTS, which Postgres
-- doesn't support for ADD CONSTRAINT) so this migration is safe to run
-- on the test project too, where the constraint already exists, without
-- erroring on a duplicate name.

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'service_reminders' and constraint_name = 'service_reminders_asset_id_fkey'
  ) then
    alter table service_reminders
      add constraint service_reminders_asset_id_fkey
      foreign key (asset_id) references assets(id) on delete cascade;
  end if;
end $$;
