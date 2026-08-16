-- Stage 1 of Fire Safety Readiness -- unblocks 86d41hgzx enough to
-- proceed. Column-add half ONLY of 20260815000000, applied to Opeke.
-- Deliberately excludes that migration's data-mutation half (the 3
-- hardcoded-UUID duplicate deletes and the 17-item classification
-- backfill) -- confirmed against live Opeke that none of those UUIDs
-- exist there; Opeke's real compliance_items (10 rows, all
-- emergency_preparedness) never went through Tineka's Stage 1 audit
-- and need their own, separate classification pass.
-- Safe/non-destructive: 3 nullable columns + 1 defaulted column, no
-- existing rows touched, workflow_templates confirmed present on Opeke
-- (18 rows) before adding the FK.

alter table public.compliance_items
  add column classification text not null default 'task'
    check (classification in ('task', 'template', 'workflow')),
  add column legal_basis text,
  add column legal_basis_detail text,
  add column workflow_template_id uuid references public.workflow_templates(id);
