-- Phase 1, item 2 (P1-02) — Release 2: make the four file buckets private,
-- trustee-only.
-- PROPOSED — DO NOT APPLY until John approves D-04 AND the Release 1 app
-- change (src/lib/secureFiles.js) is live on the website. Applying this
-- first would make every file link in the app stop opening.
--
-- Order: test project → check → Terere → Ōpeke, one at a time, at a quiet time.
-- Rollback: P1-02_private_file_buckets_rollback.sql (one step, restores the
-- previous public state and policies).
--
-- Effect:
--   • documents, compliance-docs, finance-receipts, emergency-response-evidence
--     become private: an old public address returns an error instead of the file.
--   • Read/upload/replace/delete limited to trustees of this marae. Community
--     members never see these modules in the app, so nothing they use changes.
--   • Saved records do NOT need converting: the app reads the storage path
--     out of the old address and asks for a 1-hour signed link.
--   • Printed Emergency Readiness Summaries: evidence links work for 1 hour
--     after printing, then stop (previously permanent and public).
--
-- Trustee test is inline (user's own profile row is always readable) so this
-- does not depend on is_trustee() having been applied to every project.
begin;

update storage.buckets set public = false
 where id in ('documents', 'compliance-docs', 'finance-receipts', 'emergency-response-evidence');

-- Old broad policies (any signed-in user could read/write/delete).
drop policy if exists "compliance-docs: allow all uploads"              on storage.objects;
drop policy if exists "finance-receipts: allow all uploads"             on storage.objects;
drop policy if exists "emergency-response-evidence: allow all uploads"  on storage.objects;
drop policy if exists "documents: authenticated insert"                 on storage.objects;
drop policy if exists "documents: authenticated update"                 on storage.objects;
drop policy if exists "documents: authenticated delete"                 on storage.objects;
drop policy if exists "documents: authenticated read"                   on storage.objects;
drop policy if exists "documents: public read"                          on storage.objects;
-- Make re-running safe.
drop policy if exists "p1 trustee files: read"   on storage.objects;
drop policy if exists "p1 trustee files: insert" on storage.objects;
drop policy if exists "p1 trustee files: update" on storage.objects;
drop policy if exists "p1 trustee files: delete" on storage.objects;

create policy "p1 trustee files: read" on storage.objects for select to authenticated
  using (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence')
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'));

create policy "p1 trustee files: insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence')
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'));

create policy "p1 trustee files: update" on storage.objects for update to authenticated
  using (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence')
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'))
  with check (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence')
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'));

create policy "p1 trustee files: delete" on storage.objects for delete to authenticated
  using (bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence')
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trustee'));

commit;
