-- ComplianceTracker.js and FinanceManager.js have called
-- supabase.storage.from('compliance-docs') / .from('finance-receipts') since
-- they were written, but neither bucket was ever actually created. Found
-- while checking the storage.objects RLS pattern before building a similar
-- attachment feature for ContractorsDirectory.js: storage.buckets on Opeke
-- only has documents, meeting-attachments, and Storage. Every upload attempt
-- against the two missing buckets fails, caught by each component's
-- soft-fail branch (console.warn, returns null) -- silent in the UI.
-- Confirmed on live Opeke: 10 compliance_items rows, 0 with a document_url.
--
-- Created public (public = true), NOT matching meeting-attachments' private
-- model -- the existing application code already calls .getPublicUrl() on
-- both buckets, which only produces a working link on a public bucket. This
-- migration makes the already-shipped code behave as originally intended,
-- not a redesign to signed URLs (that would be a separate, larger change to
-- two other components, out of scope here).
--
-- Write access restricted to authenticated only, matching meeting-attachments'
-- policy pattern (not documents' fully-public {public} role) -- reasonable
-- default so only logged-in trustees can upload/delete these documents, even
-- though anyone with a direct link can read them once public.
--
-- Idempotent / safe to re-run.

insert into storage.buckets (id, name, public)
values ('compliance-docs', 'compliance-docs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('finance-receipts', 'finance-receipts', true)
on conflict (id) do nothing;

drop policy if exists "compliance-docs: allow all uploads" on storage.objects;
create policy "compliance-docs: allow all uploads"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'compliance-docs')
  with check (bucket_id = 'compliance-docs');

drop policy if exists "finance-receipts: allow all uploads" on storage.objects;
create policy "finance-receipts: allow all uploads"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'finance-receipts')
  with check (bucket_id = 'finance-receipts');
