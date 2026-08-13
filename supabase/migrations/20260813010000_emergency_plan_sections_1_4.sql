-- Marae Emergency Preparedness Plan, Stage 2 (Sections 1-4: History, Hazards,
-- Warnings, Marae/Emergency Contacts). Data model designed and confirmed in
-- ClickUp 86d40q5e7, Stage 1, against the real official document (Waikato
-- District Council / CDEM template), read directly page by page.
--
-- "How Will We Be Warned" (Section 3) has zero blank fields in the real
-- template -- static CDEM guidance text, no table needed here.
--
-- emergency_plan_people covers three sections total (not just 1-4): the two
-- Name/Phone lists built now (Marae Contacts, Emergency Contacts) plus Our
-- Skilled People (marae_operator/first_aider/specialised_skill), which is
-- Stage 3 -- declaring the full role_category shape now avoids a second
-- ALTER later, since the shape was already fully designed and confirmed in
-- Stage 1. No Stage 3 UI or behaviour is implied by this.
--
-- entity_id is nullable on both new tables (shared marae-wide when null),
-- matching the existing assets/documents/bookings convention. Not
-- admin-only RLS -- these four sections are not confidential in the source
-- document (unlike Sections 12/13, which get real access restrictions when
-- built in Stage 3).

alter table marae_settings add column if not exists emergency_plan_supported_by text;
alter table marae_settings add column if not exists emergency_plan_history text;

create table if not exists emergency_plan_people (
  id uuid not null default gen_random_uuid(),
  role_category text not null,
  full_name text not null,
  phone text,
  skill_type text,
  entity_id uuid,
  created_at timestamp with time zone not null default now()
);

alter table emergency_plan_people add constraint emergency_plan_people_pkey primary key (id);
alter table emergency_plan_people add constraint emergency_plan_people_entity_id_fkey foreign key (entity_id) references entities(id) on delete restrict;
alter table emergency_plan_people add constraint emergency_plan_people_role_category_check
  check (role_category = any (array['marae_contact','emergency_contact','marae_operator','first_aider','specialised_skill']));

alter table emergency_plan_people enable row level security;

create policy "Trustees can manage emergency plan people within their entities"
  on emergency_plan_people for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  );

create table if not exists emergency_plan_hazards (
  id uuid not null default gen_random_uuid(),
  hazard_type text not null,
  likely_impact text,
  what_to_do text,
  entity_id uuid,
  created_at timestamp with time zone not null default now()
);

alter table emergency_plan_hazards add constraint emergency_plan_hazards_pkey primary key (id);
alter table emergency_plan_hazards add constraint emergency_plan_hazards_entity_id_fkey foreign key (entity_id) references entities(id) on delete restrict;
alter table emergency_plan_hazards add constraint emergency_plan_hazards_hazard_type_check
  check (hazard_type = any (array['Landslide','Flood','Earthquake','Fire','Storm','Tsunami','Volcano','Pandemic','Man-Made Hazard']));

alter table emergency_plan_hazards enable row level security;

create policy "Trustees can manage emergency plan hazards within their entities"
  on emergency_plan_hazards for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  );

-- Seed the 9 fixed hazard types (shared, entity_id null) so Section 2 always
-- shows all 9 with blanks to fill, matching the printed template. Table is
-- brand new here so no duplicate risk, but guarded anyway for safe re-runs.
insert into emergency_plan_hazards (hazard_type, entity_id)
select h, null
from unnest(array['Landslide','Flood','Earthquake','Fire','Storm','Tsunami','Volcano','Pandemic','Man-Made Hazard']) as h
where not exists (
  select 1 from emergency_plan_hazards where hazard_type = h and entity_id is null
);
