-- Originally tested on the test project (zfefukxaliuximizjkwa) only; now
-- also applied to Opeke/Terere (14yhc7kv4t3 follow-up). Found while
-- investigating the PROVE step: the `documents` storage bucket's write
-- policies ("Allow all uploads"/ALL, the INSERT policy, "Allow
-- deletes"/DELETE) are all granted to role `public`, which in Postgres/
-- Supabase includes unauthenticated (anon) requests, not just logged-in
-- users -- unlike every other bucket in this project (compliance-docs,
-- finance-receipts, emergency-response-evidence, contractor-docs,
-- meeting-attachments), which are already `to authenticated` only.
-- Table-level RLS on the `documents` table itself still requires a
-- trustee + entity match, but that doesn't apply to the storage layer --
-- an anonymous request straight to the Storage API could upload,
-- overwrite, or delete objects in this bucket.
--
-- Read access ("Allow reads"/SELECT, public) is left untouched -- the
-- bucket is public by design (app code calls getPublicUrl(), not signed
-- URLs) and existing `documents.file_url` links depend on anonymous read
-- continuing to work.
--
-- compliance-docs/finance-receipts/emergency-response-evidence checked
-- directly (pg_policies) and do NOT have this pattern -- already
-- `to authenticated` only, single ALL policy each -- so no change needed
-- there.
--
-- Scope: `documents` bucket only, this project only. Deliberately not
-- touching the separate legacy `maraehub` bucket's "Allow all maraehub"
-- policy (same public-role pattern) -- out of scope for this change,
-- flagged separately.
--
-- Idempotent / safe to re-run.
--
-- The public INSERT policy's name differs by project -- "Allow inserts"
-- on the test project, "Allow uploads" on Opeke -- so both are dropped;
-- whichever doesn't exist on a given project is a no-op.

drop policy if exists "Allow all uploads" on storage.objects;
drop policy if exists "Allow inserts" on storage.objects;
drop policy if exists "Allow uploads" on storage.objects;
drop policy if exists "Allow deletes" on storage.objects;

create policy "documents: authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');

create policy "documents: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

create policy "documents: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents');
