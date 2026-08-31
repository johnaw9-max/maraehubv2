-- Documents -> Compliance evidence linking (86d44k6a7). Real check
-- before designing: zero compliance items on either project currently
-- have any evidence attached (document_url is null everywhere), so
-- unlike the Assets<->Compliance link this needs no backfill -- this
-- one is genuinely greenfield.
--
-- ON DELETE SET NULL, not RESTRICT (same reasoning as
-- linked_service_reminder_id): DocumentsManager.js's handleDelete()
-- lets a trustee delete a document outright. RESTRICT would block
-- that existing behavior the first time someone deleted a linked
-- document.
alter table compliance_items
  add column linked_document_id uuid references documents(id) on delete set null;
