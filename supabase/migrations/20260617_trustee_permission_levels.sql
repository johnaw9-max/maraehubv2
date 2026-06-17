-- Add trustee_role to profiles: 'standard' or 'admin'
-- Standard trustees can view/edit but cannot approve bookings, access Finance, or change user permissions
-- Admin trustees have full access

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trustee_role text DEFAULT 'standard'
CHECK (trustee_role IN ('standard', 'admin'));

-- Promote the earliest-created trustee to admin (so first real trustee gets admin)
WITH first_trustee AS (
  SELECT id FROM profiles
  WHERE role = 'trustee'
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE profiles
SET trustee_role = 'admin'
WHERE id IN (SELECT id FROM first_trustee);
