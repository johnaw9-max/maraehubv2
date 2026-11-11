-- Recently deleted for documents: deleting a document hides it for 30 days instead of
-- erasing it. The storage file is kept until the document is permanently deleted.
-- Existing RLS ("Trustees can manage documents within their entities", FOR ALL) already
-- covers the update that sets / clears these columns.
alter table public.documents add column if not exists deleted_at timestamptz;
alter table public.documents add column if not exists deleted_by uuid references auth.users(id) on delete set null;
create index if not exists documents_deleted_at_idx on public.documents (deleted_at) where deleted_at is not null;
