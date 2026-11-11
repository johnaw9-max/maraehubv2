-- Let a Building Plan pin point at an asset from the Assets register.
-- The service date stays in service_reminders; the plan only displays it.
-- Deleting an asset just unlinks the pin (pin stays on the plan).
alter table public.emergency_plan_pins
  add column if not exists asset_id uuid references public.assets(id) on delete set null;
