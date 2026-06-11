-- Fix responsible person to store a name (text) instead of a UUID FK.
-- Matches the existing pattern used by projects.lead and tasks.assigned_to.
-- The contacts table holds real trustees who have no Supabase auth account,
-- so their UUIDs cannot satisfy a FK → profiles(id). Storing a name string
-- means trustees from both profiles and contacts can be selected.

ALTER TABLE compliance_items DROP COLUMN IF EXISTS responsible_id;
ALTER TABLE compliance_items ADD  COLUMN IF NOT EXISTS responsible_name text;

ALTER TABLE incidents        DROP COLUMN IF EXISTS responsible_id;
ALTER TABLE incidents        ADD  COLUMN IF NOT EXISTS responsible_name text;

ALTER TABLE goals            DROP COLUMN IF EXISTS responsible_id;
ALTER TABLE goals            ADD  COLUMN IF NOT EXISTS responsible_name text;
