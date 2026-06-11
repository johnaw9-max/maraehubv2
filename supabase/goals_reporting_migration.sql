-- Goals & Reporting Module Migration
-- Run on TEST first (zfefukxaliuximizjkwa), then LIVE (cbeenkpjpnhmtqtnjiyd) after confirming

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text,
  category        text        NOT NULL DEFAULT 'governance',
  responsible_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  start_date      date,
  target_date     date,
  status          text        NOT NULL DEFAULT 'not_started'
                              CHECK (status IN ('not_started', 'in_progress', 'at_risk', 'completed')),
  progress        integer     NOT NULL DEFAULT 0
                              CHECK (progress >= 0 AND progress <= 100),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Goal links — joins goals to projects, compliance_items, or grants
CREATE TABLE IF NOT EXISTS goal_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid        NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  link_type   text        NOT NULL
              CHECK (link_type IN ('project', 'compliance_item', 'grant')),
  link_id     uuid        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (goal_id, link_type, link_id)
);

-- Enable RLS
ALTER TABLE goals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_links ENABLE ROW LEVEL SECURITY;

-- Trustees can do everything
CREATE POLICY "Trustees manage goals" ON goals
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trustee'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trustee'));

CREATE POLICY "Trustees manage goal_links" ON goal_links
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trustee'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trustee'));
