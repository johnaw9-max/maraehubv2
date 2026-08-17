-- Real test fixtures on Tineka to verify the full fire safety
-- compliance flow end-to-end -- notify-trustees, dashboard status,
-- and Contacts -- before trusting it as proven. Tineka never received
-- the 5 fire safety items (all prior work was Opeke-only), so they
-- are created here fresh, matching Opeke exactly (same names, same
-- cadences, same due_date reasoning: 30 days out).
--
-- Test Fire Warden contact matches the real, existing "Test X" naming
-- convention already used in profiles (Test Trustee, Test Community)
-- -- Contacts had no prior test-data convention of its own. role
-- stays 'community' (a real, valid dropdown value, not a fabricated
-- one -- see 17 Aug finding that role is not freetext); the Fire
-- Warden designation itself goes in notes, matching the same reasoning
-- already applied when Stage 4 was originally scoped on Opeke.

insert into public.compliance_items (category, name, renewal_months, classification, workflow_template_id, due_date) values
  ('emergency_preparedness', 'Fire extinguishers — inspected and serviced', 12, 'task', null, current_date + interval '30 days'),
  ('emergency_preparedness', 'Fire alarms — tested and detection confirmed working', 6, 'task', null, current_date + interval '30 days'),
  ('emergency_preparedness', 'Emergency exits — checked clear, signed and operational', 6, 'task', null, current_date + interval '30 days'),
  ('emergency_preparedness', 'Evacuation scheme — reviewed and trial evacuation completed', 6, 'workflow', 'ebe303f6-a1be-4950-a722-b8a9dc91e101', current_date + interval '30 days'),
  ('emergency_preparedness', 'Fire warden arrangements — trained and refreshed', 6, 'task', null, current_date + interval '30 days');

insert into public.contacts (full_name, role, notes) values
  ('Test Fire Warden', 'community', 'TEST DATA — created 17 Aug 2026 to verify the Fire Safety Readiness Contacts flow on Tineka. Designated role: Fire Warden. Not a real person.');
