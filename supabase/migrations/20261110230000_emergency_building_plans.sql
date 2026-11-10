-- Building Plan: a marae uploads a picture of its floor plan (or a photo/screenshot
-- of one) and drops pins on it for first aid, fire gear, shut-offs, exits and so on.
-- Pins are stored as a percentage of the picture width/height so they stay in the
-- right place at any screen size. The picture lives in the existing private
-- 'emergency-response-evidence' bucket under plans/.

create table if not exists emergency_building_plans (
  id uuid not null default gen_random_uuid(),
  entity_id uuid,
  name text not null,
  image_path text not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

alter table emergency_building_plans add constraint emergency_building_plans_pkey PRIMARY KEY (id);
alter table emergency_building_plans add constraint emergency_building_plans_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table emergency_building_plans add constraint emergency_building_plans_name_check CHECK (length(btrim(name)) > 0);

create table if not exists emergency_plan_pins (
  id uuid not null default gen_random_uuid(),
  plan_id uuid not null,
  pin_type text not null,
  label text not null,
  x_pct numeric not null,
  y_pct numeric not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

alter table emergency_plan_pins add constraint emergency_plan_pins_pkey PRIMARY KEY (id);
alter table emergency_plan_pins add constraint emergency_plan_pins_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES emergency_building_plans(id) ON DELETE CASCADE;
alter table emergency_plan_pins add constraint emergency_plan_pins_type_check CHECK (pin_type IN (
  'first_aid', 'defibrillator', 'fire_extinguisher', 'fire_alarm', 'exit',
  'power_shutoff', 'water_shutoff', 'gas_shutoff', 'assembly_point', 'torch_radio', 'other'
));
alter table emergency_plan_pins add constraint emergency_plan_pins_x_check CHECK (x_pct BETWEEN 0 AND 100);
alter table emergency_plan_pins add constraint emergency_plan_pins_y_check CHECK (y_pct BETWEEN 0 AND 100);
alter table emergency_plan_pins add constraint emergency_plan_pins_label_check CHECK (length(btrim(label)) > 0);

create index if not exists emergency_plan_pins_plan_id_idx on emergency_plan_pins (plan_id);

alter table emergency_building_plans enable row level security;
alter table emergency_plan_pins enable row level security;

-- Same shape as emergency_map_points: any trustee within their entity.
create policy "Trustees can manage building plans within their entities"
  on emergency_building_plans for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  );

-- Pins follow their plan's entity.
create policy "Trustees can manage plan pins within their entities"
  on emergency_plan_pins for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and exists (select 1 from emergency_building_plans p where p.id = plan_id and is_entity_member(p.entity_id))
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and exists (select 1 from emergency_building_plans p where p.id = plan_id and is_entity_member(p.entity_id))
  );
