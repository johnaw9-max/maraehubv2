-- Rollback for P1-02_private_file_buckets.sql: restores the pre-Phase-1 state
-- (public buckets, any signed-in user may read/write). Use only if Release 2
-- breaks file access and the cause cannot be fixed quickly.
begin;

drop policy if exists "p1 trustee files: read"   on storage.objects;
drop policy if exists "p1 trustee files: insert" on storage.objects;
drop policy if exists "p1 trustee files: update" on storage.objects;
drop policy if exists "p1 trustee files: delete" on storage.objects;

-- Make re-running safe.
drop policy if exists "compliance-docs: allow all uploads"             on storage.objects;
drop policy if exists "finance-receipts: allow all uploads"            on storage.objects;
drop policy if exists "emergency-response-evidence: allow all uploads" on storage.objects;
drop policy if exists "documents: authenticated insert" on storage.objects;
drop policy if exists "documents: authenticated update" on storage.objects;
drop policy if exists "documents: authenticated delete" on storage.objects;
drop policy if exists "documents: authenticated read"   on storage.objects;

update storage.buckets set public = true
 where id in ('documents', 'compliance-docs', 'finance-receipts', 'emergency-response-evidence');

create policy "compliance-docs: allow all uploads" on storage.objects for all to authenticated
  using (bucket_id = 'compliance-docs') with check (bucket_id = 'compliance-docs');
create policy "finance-receipts: allow all uploads" on storage.objects for all to authenticated
  using (bucket_id = 'finance-receipts') with check (bucket_id = 'finance-receipts');
create policy "emergency-response-evidence: allow all uploads" on storage.objects for all to authenticated
  using (bucket_id = 'emergency-response-evidence') with check (bucket_id = 'emergency-response-evidence');
create policy "documents: authenticated insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');
create policy "documents: authenticated update" on storage.objects for update to authenticated
  using (bucket_id = 'documents') with check (bucket_id = 'documents');
create policy "documents: authenticated delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents');
create policy "documents: authenticated read" on storage.objects for select to authenticated
  using (bucket_id = 'documents');

commit;
