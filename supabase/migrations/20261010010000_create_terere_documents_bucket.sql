-- Terere (fwtxbirekiyhbxqdctkq) has no `documents` bucket at all (confirmed
-- directly via storage.buckets, 14yhc7kv4t3 follow-up). Document Library
-- uploads there silently soft-fail: the `documents` table row gets created
-- but the file is never actually stored -- same failure mode already
-- documented for the old missing compliance-docs/finance-receipts buckets
-- (20260810000000).
--
-- Created public (public = true), matching Opeke/the test project's
-- `documents` bucket -- app code calls getPublicUrl() on this bucket,
-- which only produces a working link on a public bucket.
--
-- Write policies are authenticated-only from the start here, matching the
-- restricted shape Opeke/the test project now have after
-- 20261010000000_restrict_documents_bucket_write_policies.sql -- not
-- reproducing the public-role write hole that fix just closed elsewhere.
-- Read is public, same reasoning as that migration.
--
-- Idempotent / safe to re-run.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "documents: authenticated insert" on storage.objects;
create policy "documents: authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');

drop policy if exists "documents: authenticated update" on storage.objects;
create policy "documents: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

drop policy if exists "documents: authenticated delete" on storage.objects;
create policy "documents: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents');

drop policy if exists "documents: public read" on storage.objects;
create policy "documents: public read"
  on storage.objects for select
  using (bucket_id = 'documents');
