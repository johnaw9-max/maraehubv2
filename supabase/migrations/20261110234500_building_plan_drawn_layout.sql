-- Most marae have no floor plan, so a plan can now be drawn in the app instead of
-- uploaded: a list of labelled rooms (rectangles) stored as percentages of a fixed
-- canvas. A plan has either an uploaded picture or a drawn layout (or both is fine).
alter table emergency_building_plans alter column image_path drop not null;
alter table emergency_building_plans add column if not exists layout jsonb;
alter table emergency_building_plans add constraint emergency_building_plans_has_content_check
  CHECK (image_path is not null or layout is not null);
alter table emergency_building_plans add constraint emergency_building_plans_layout_is_array_check
  CHECK (layout is null or jsonb_typeof(layout) = 'array');
