-- Contractor document attachments (e.g. certificates, insurance, contracts).
-- ContractorsDirectory.js currently has no attachment support at all --
-- confirmed by direct grep, zero matches for upload/attach/file/storage.
--
-- Signed-URL model, matching Committee Minutes (not Compliance/Finance's
-- public-bucket model, confirmed as the user's explicit choice): document_url
-- stores the raw storage path, not a full URL -- a fresh signed link is
-- generated lazily on click via createSignedUrl(), never persisted. Bucket
-- is therefore private (public = false), unlike compliance-docs/
-- finance-receipts.
--
-- Single ALL policy per bucket, not Minutes' original 4 overlapping
-- policies -- Minutes' own "allow all uploads" ALL policy already covers
-- insert/select/update/delete on its own, so replicating the other 3 would
-- be pure redundancy. Same simplification already applied for
-- compliance-docs/finance-receipts (20260810000000).
--
-- Idempotent / safe to re-run.

alter table contractors add column if not exists document_url text;
alter table contractors add column if not exists document_name text;

insert into storage.buckets (id, name, public)
values ('contractor-docs', 'contractor-docs', false)
on conflict (id) do nothing;

drop policy if exists "contractor-docs: allow all uploads" on storage.objects;
create policy "contractor-docs: allow all uploads"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'contractor-docs')
  with check (bucket_id = 'contractor-docs');
