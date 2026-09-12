-- Real trustee request (14yhc7kphv2): a simple map showing the marae's real
-- location, with key emergency features marked (water source, evacuation
-- routes, key assets). Investigated first -- nothing in the existing schema
-- was map-ready (no lat/lng anywhere, existing location fields are unreliable
-- free text). Option C chosen: minimal MVP, manual pin-drop, no auto-geocoding.

-- marae_settings: one-time pin drop for the marae's own real location.
alter table marae_settings add column if not exists latitude numeric;
alter table marae_settings add column if not exists longitude numeric;
alter table marae_settings add constraint marae_settings_latitude_check check (latitude is null or latitude between -90 and 90);
alter table marae_settings add constraint marae_settings_longitude_check check (longitude is null or longitude between -180 and 180);

-- Hand-added emergency map points: water sources, muster/evacuation points,
-- and key physical assets. Deliberately POINTS, not routed lines -- a real
-- evacuation route needs real path-tracing data nothing here has; a marked
-- muster point is the honest simplification, not a substitute for one.
create table if not exists emergency_map_points (
  id uuid not null default gen_random_uuid(),
  entity_id uuid,
  point_type text not null,
  label text not null,
  latitude numeric not null,
  longitude numeric not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

alter table emergency_map_points add constraint emergency_map_points_pkey PRIMARY KEY (id);
alter table emergency_map_points add constraint emergency_map_points_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table emergency_map_points add constraint emergency_map_points_point_type_check CHECK (point_type IN ('water_source', 'muster_point', 'key_asset', 'other'));
alter table emergency_map_points add constraint emergency_map_points_latitude_check CHECK (latitude BETWEEN -90 AND 90);
alter table emergency_map_points add constraint emergency_map_points_longitude_check CHECK (longitude BETWEEN -180 AND 180);

alter table emergency_map_points enable row level security;

-- Same shape as emergency_response_events' real RLS -- any trustee (not
-- admin-only) within their entity, matching how the rest of Emergency Plan
-- already works.
create policy "Trustees can manage emergency map points within their entities"
  on emergency_map_points for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  );
