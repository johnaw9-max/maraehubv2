-- Post #7 (Fragmented Administration). Real audit found zero link between
-- Compliance and Finance -- a compliance renewal (e.g. fire extinguisher
-- servicing) had no connection to the actual expense that paid for it.
-- Exact same shape as linked_document_id / linked_service_reminder_id,
-- same ON DELETE SET NULL reasoning -- FinanceManager.js's handleDelete()
-- lets a trustee delete an expense outright, that should unlink the
-- compliance item, not block the delete.

alter table compliance_items
  add column linked_expense_id uuid references finance_expenses(id) on delete set null;
