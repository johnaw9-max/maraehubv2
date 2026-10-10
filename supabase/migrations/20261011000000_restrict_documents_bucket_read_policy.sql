-- Follow-up to 20261010000000 (14yhc7kv4t3). That migration left the
-- `documents` bucket's SELECT policy ("Allow reads", role public)
-- untouched deliberately, so existing `documents.file_url` links kept
-- working. Confirmed since (grep of every supabase.storage call against
-- the `documents` bucket): `getPublicUrl()` never makes a network
-- request and never depends on this SELECT policy at all -- the URL it
-- returns is served by Supabase Storage's public-bucket bypass route,
-- which skips RLS entirely for buckets with public = true. The SELECT
-- policy only gates the authenticated API's list/get routes.
--
-- That meant the public SELECT policy was doing nothing for the app's
-- actual read path, while still letting an anonymous caller enumerate
-- every object in the bucket via the storage list endpoint (confirmed:
-- anon list on the test project's `documents` bucket returned a real
-- object). No app code calls list() or createSignedUrl() against this
-- bucket, so there is no legitimate caller relying on anonymous list/get
-- access either.
--
-- Replacing the public SELECT policy with an authenticated-only one,
-- matching the role restriction already used by compliance-docs/
-- finance-receipts/emergency-response-evidence's SELECT access (bundled
-- into their single ALL policy). Existing getPublicUrl() links are
-- unaffected, per the bypass-route reasoning above.
--
-- Idempotent / safe to re-run.
--
-- The public SELECT policy's name differs by project -- "Allow reads" on
-- the test project and Opeke, "documents: public read" on Terere (from
-- the migration that created its bucket) -- so both are dropped;
-- whichever doesn't exist on a given project is a no-op.

drop policy if exists "Allow reads" on storage.objects;
drop policy if exists "documents: public read" on storage.objects;

create policy "documents: authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');
