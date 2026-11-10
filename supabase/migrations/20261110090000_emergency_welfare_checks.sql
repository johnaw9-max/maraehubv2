-- Emergency Plan: Welfare Check list (whānau who may need checking on or
-- help in an emergency, e.g. kaumātua).
--
-- Private information about vulnerable people, so by design:
--   * trustees only (same entity-aware RLS as the rest of the Emergency Plan;
--     community members and anonymous users get nothing)
--   * minimal data: name, phone, where to find them, tick-box kinds of help
--     needed, a short note. No medical conditions or diagnoses are asked for.
--   * consent_confirmed must be true to save a row (enforced here, not only
--     in the app): the person, or their whānau, knows they are on this list.
--   * checker_id links to an existing Emergency Contact (who will check on
--     them); on delete set null so removing a contact never deletes a person.
-- entity_id is nullable (shared marae-wide when null), same as the other
-- Emergency Plan tables.

create table if not exists emergency_welfare_checks (
  id uuid not null default gen_random_uuid(),
  full_name text not null,
  phone text,
  usual_location text,
  needs text[] not null default '{}',
  notes text,
  checker_id uuid,
  last_checked date,
  consent_confirmed boolean not null default false,
  entity_id uuid,
  created_at timestamp with time zone not null default now()
);

alter table emergency_welfare_checks drop constraint if exists emergency_welfare_checks_pkey;
alter table emergency_welfare_checks add constraint emergency_welfare_checks_pkey primary key (id);

alter table emergency_welfare_checks drop constraint if exists emergency_welfare_checks_entity_id_fkey;
alter table emergency_welfare_checks add constraint emergency_welfare_checks_entity_id_fkey
  foreign key (entity_id) references entities(id) on delete restrict;

alter table emergency_welfare_checks drop constraint if exists emergency_welfare_checks_checker_id_fkey;
alter table emergency_welfare_checks add constraint emergency_welfare_checks_checker_id_fkey
  foreign key (checker_id) references emergency_plan_people(id) on delete set null;

alter table emergency_welfare_checks drop constraint if exists emergency_welfare_checks_consent_check;
alter table emergency_welfare_checks add constraint emergency_welfare_checks_consent_check
  check (consent_confirmed = true);

alter table emergency_welfare_checks drop constraint if exists emergency_welfare_checks_needs_check;
alter table emergency_welfare_checks add constraint emergency_welfare_checks_needs_check
  check (needs <@ array['mobility','power_equipment','medication','lives_alone','hearing_sight','transport','other']::text[]);

alter table emergency_welfare_checks enable row level security;

drop policy if exists "Trustees can manage welfare checks within their entities" on emergency_welfare_checks;
create policy "Trustees can manage welfare checks within their entities"
  on emergency_welfare_checks for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  );
