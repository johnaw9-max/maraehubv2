-- Post #7 (Fragmented Administration). Real audit found the assets table
-- has no document attachment capability at all -- not even a raw
-- document_url column, let alone a link table. A warranty, manual, or
-- purchase invoice for an asset had genuinely nowhere to live with a
-- back-reference. Exact same shape as compliance_items.linked_document_id,
-- same ON DELETE SET NULL reasoning -- DocumentsManager.js lets a trustee
-- delete a document outright, that should unlink the asset, not block
-- the delete.

alter table assets
  add column linked_document_id uuid references documents(id) on delete set null;
