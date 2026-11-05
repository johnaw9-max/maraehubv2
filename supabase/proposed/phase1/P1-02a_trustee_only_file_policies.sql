-- M3 · P1-02a · File rules: only trustees may read, upload, replace or delete
-- files in the four trustee buckets. Buckets STAY PUBLIC in this step (M4 does that),
-- so existing public file addresses keep working; this step only removes community
-- members' ability to upload/replace/delete and to request signed links.
-- No files, buckets or tables are deleted. contractor-docs, meeting-attachments
-- and any other bucket are untouched.
begin;
drop policy if exists "compliance-docs: allow all uploads"             on storage.objects;
drop policy if exists "finance-receipts: allow all uploads"            on storage.objects;
drop policy if exists "emergency-response-evidence: allow all uploads" on storage.objects;
drop policy if exists "documents: authenticated insert"                on storage.objects;
drop policy if exists "documents: authenticated update"                on storage.objects;
drop policy if exists "documents: authenticated delete"                on storage.objects;
drop policy if exists "documents: authenticated read"                  on storage.objects;
drop policy if exists "documents: public read"                         on storage.objects;
drop policy if exists "p1 trustee files: read"   on storage.objects;  -- re-run safety
drop policy if exists "p1 trustee files: insert" on storage.objects;
drop policy if exists "p1 trustee files: update" on storage.objects;
drop policy if exists "p1 trustee files: delete" on storage.objects;
create policy "p1 trustee files: read" on storage.objects for select to authenticated
  using (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and public.is_trustee());
create policy "p1 trustee files: insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and public.is_trustee());
create policy "p1 trustee files: update" on storage.objects for update to authenticated
  using (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and public.is_trustee())
  with check (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and public.is_trustee());
create policy "p1 trustee files: delete" on storage.objects for delete to authenticated
  using (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and public.is_trustee());
commit;
