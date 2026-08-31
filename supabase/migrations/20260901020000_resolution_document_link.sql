-- Minutes -> Governance trail (86d44k6c0), final piece of 86d44dg0t.
-- Real check before designing: meeting_actions.resolution_id already
-- links a decision to its follow-up action (real, working), but real
-- data shows zero usage of that link across 10 real resolutions on
-- Opeke. Evidence is placed on the decision itself, not gated behind
-- the unused action layer -- matches how resolutions are actually used
-- in practice (e.g. "Motion: To accept the draft Marae Preparedness
-- Plan", a real Opeke resolution with no action and none expected).
--
-- ON DELETE SET NULL, same reasoning as the three prior link columns
-- this session: DocumentsManager.js lets a trustee delete a document
-- outright.
alter table resolutions
  add column linked_document_id uuid references documents(id) on delete set null;
