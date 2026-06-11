-- Fix Goals RLS to match the same pattern as all other MaraeHub tables
-- (grants, compliance_items, profiles all use authenticated + USING(true))
-- Single-tenant deployment: one Supabase project = one marae, so any
-- authenticated user in this project is a member of this marae.
-- App-layer access control (TrusteeDashboard) handles who sees the Goals tab.

-- Drop the over-restrictive trustee-role policies
DROP POLICY IF EXISTS "Trustees manage goals"      ON goals;
DROP POLICY IF EXISTS "Trustees manage goal_links" ON goal_links;

-- Replace with standard authenticated-access pattern used by all other tables
CREATE POLICY "goals: authenticated full access" ON goals
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "goal_links: authenticated full access" ON goal_links
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
