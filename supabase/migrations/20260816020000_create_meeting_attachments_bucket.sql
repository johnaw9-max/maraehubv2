-- Creates the meeting-attachments storage bucket, flagged missing by the
-- Stage 4 process/config safety check (86d3u7790) -- CommitteeMinutes.js
-- depends on it via createSignedUrl(), the same private-bucket access
-- pattern already used for contractor-docs, not the public-bucket pattern
-- used by documents/compliance-docs/finance-receipts. Confirmed by
-- checking the real calling code before deciding public vs private.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-attachments', 'meeting-attachments', false, null, null);

-- Same shape as the existing "compliance-docs: allow all uploads" /
-- "contractor-docs: allow all uploads" / "finance-receipts: allow all
-- uploads" policies -- ALL command, authenticated role only.
create policy "meeting-attachments: allow all uploads"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'meeting-attachments')
  with check (bucket_id = 'meeting-attachments');
