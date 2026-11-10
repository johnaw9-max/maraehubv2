-- Two more pin types for the Building Plan: the generator and where its keys are kept.
alter table emergency_plan_pins drop constraint emergency_plan_pins_type_check;
alter table emergency_plan_pins add constraint emergency_plan_pins_type_check CHECK (pin_type IN (
  'first_aid', 'defibrillator', 'fire_extinguisher', 'fire_alarm', 'exit',
  'power_shutoff', 'water_shutoff', 'gas_shutoff', 'assembly_point', 'torch_radio',
  'generator', 'key_box', 'other'
));
