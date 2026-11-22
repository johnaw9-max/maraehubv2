-- "Not applicable, with a reason": a marae can record that a Framework item does not apply to it, instead of leaving it as a permanent gap.
-- Additive: three nullable columns, no existing row changes. An item with not_applicable_at set is hidden from gap lists and counts but never deleted, so the record of who said it, why and when is kept.
alter table public.compliance_items add column if not exists not_applicable_reason text;
alter table public.compliance_items add column if not exists not_applicable_by text;
alter table public.compliance_items add column if not exists not_applicable_at timestamp with time zone;
