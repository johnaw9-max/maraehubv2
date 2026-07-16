-- Combined migration: create compliance tables (if missing) and fix all three
-- tables to use responsible_name (text) instead of responsible_id (UUID FK).
-- Safe to run on a fresh project or one that already has the tables.

-- ── COMPLIANCE ITEMS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_items (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category         text        NOT NULL CHECK (category IN (
                                 'building','insurance','trustee',
                                 'health_safety','civil_defence','other')),
  name             text        NOT NULL,
  due_date         date,
  renewal_months   integer,
  responsible_name text,
  notes            text,
  document_url     text,
  document_name    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- If table already existed with the old UUID FK column, swap it out
ALTER TABLE compliance_items DROP   COLUMN IF EXISTS responsible_id;
ALTER TABLE compliance_items ADD    COLUMN IF NOT EXISTS responsible_name text;

ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='compliance_items' AND policyname='compliance_items: authenticated full access') THEN
    CREATE POLICY "compliance_items: authenticated full access" ON compliance_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── INCIDENTS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_date    date        NOT NULL DEFAULT current_date,
  title            text        NOT NULL,
  description      text,
  location         text,
  severity         text        NOT NULL DEFAULT 'minor'
                               CHECK (severity IN ('minor','moderate','serious','critical')),
  people_involved  text,
  responsible_name text,
  action_taken     text,
  follow_up_date   date,
  resolved         boolean     NOT NULL DEFAULT false,
  document_url     text,
  document_name    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incidents DROP   COLUMN IF EXISTS responsible_id;
ALTER TABLE incidents ADD    COLUMN IF NOT EXISTS responsible_name text;

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incidents' AND policyname='incidents: authenticated full access') THEN
    CREATE POLICY "incidents: authenticated full access" ON incidents
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── GOALS ─────────────────────────────────────────────────────────────────────
-- Table already exists — just swap the column

ALTER TABLE goals DROP   COLUMN IF EXISTS responsible_id;
ALTER TABLE goals ADD    COLUMN IF NOT EXISTS responsible_name text;

-- ── SEED DATA ─────────────────────────────────────────────────────────────────
-- Only insert if compliance_items is empty

INSERT INTO compliance_items (category, name, renewal_months)
SELECT * FROM (VALUES
  ('building',      'Building Warrant of Fitness',          12),
  ('insurance',     'Building & Contents Insurance',        12),
  ('insurance',     'Public Liability Insurance',           12),
  ('trustee',       'Trustee Elections / Term Review',      36),
  ('health_safety', 'Health & Safety Policy Review',        12),
  ('health_safety', 'First Aid Kit Inspection',              6),
  ('health_safety', 'Fire Extinguisher Service',            12),
  ('health_safety', 'Emergency Evacuation Drill',           12),
  ('civil_defence', 'Civil Defence Emergency Plan Review',  24),
  ('civil_defence', 'Emergency Contact List Update',        12)
) AS v(category, name, renewal_months)
WHERE NOT EXISTS (SELECT 1 FROM compliance_items LIMIT 1);
