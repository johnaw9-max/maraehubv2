-- Make sensitive storage buckets private (Phase 1 security, task [2]).
-- The app already uses createSignedUrl everywhere for file access, so
-- flipping these to private does not break any existing functionality.
-- maraehub bucket (logos/branding) stays public intentionally.
UPDATE storage.buckets
SET public = false
WHERE name IN ('compliance-docs', 'documents', 'emergency-response-evidence', 'finance-receipts')
  AND public = true;
