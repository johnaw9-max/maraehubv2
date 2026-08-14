-- Stage 2 (86d41epk8): adds classification + legal-basis fields, resolves
-- the 3 duplicate pairs Stage 1 found. Applied Tineka first per Rule 3.

-- 1. New columns. legal_basis/legal_basis_detail intentionally left NULL
--    for every row in this migration -- real per-item legal citations
--    weren't verified and are not guessed here; that's Stage 4's job.
alter table public.compliance_items
  add column classification text not null default 'task'
    check (classification in ('task', 'template', 'workflow')),
  add column legal_basis text,
  add column legal_basis_detail text;

-- 2. Resolve the 3 duplicate pairs: delete the EP_SEED_ITEMS-sourced half,
--    keep the shorter/manually-authored half, per confirmed choices.
delete from public.compliance_items where id in (
  'b29dfd73-ee7b-44a7-8aa9-7b4f6dd8973d', -- EP: "Civil Defence Emergency Plan — reviewed and up to date"
  '2d0792a1-6ec4-43df-8c7e-5ea60a17ccf0', -- EP: "Emergency contact list — trustees, key community..."
  '080c1f65-24b4-4749-b78e-dd63fcab8193'  -- EP: "First aid kit — stocked and in date"
);

-- 3. Cadence on survivors. Pair 1 confirmed explicitly (annual). Pair 2's
--    6mo was proposed (contact/trustee-turnover info goes stale faster
--    than 12mo) and confirmed.
update public.compliance_items set renewal_months = 12
  where id = '359e66c3-40ae-4c54-81b8-f43978ef82e4'; -- "Civil Defence Emergency Plan Review" (was 24mo)
update public.compliance_items set renewal_months = 6
  where id = '195786d0-9dc1-4f98-9305-8cb012bfa760'; -- "Emergency Contact List Update" (was 12mo)

-- 4. Classification backfill -- all 17 canonical items, per Stage 1's audit.
update public.compliance_items set classification = 'template' where id in (
  'e7aab4c7-d171-47d0-9c10-b9f860d226cf', -- Building Warrant of Fitness
  '359e66c3-40ae-4c54-81b8-f43978ef82e4', -- Civil Defence Emergency Plan Review
  '46ccb925-4d4c-4283-886f-a63d630b4e82'  -- Health & Safety Policy Review
);
update public.compliance_items set classification = 'workflow' where id in (
  '029cdcd0-0e65-42ea-b7d5-9efac9e00756', -- Evacuation routes
  'd6b83cf7-0c50-4ab6-ad9c-472dd2919853', -- Generator — tested, fuelled, serviced
  '372fb428-3df8-40dd-8fab-2b856c6f3060', -- Marae structure — storm readiness
  '3af2da8e-4d73-4811-bbae-273a3723d3a1', -- Water supply — 10,000L tank
  '75398129-67f1-45c8-9dc8-0a7c8e845505', -- Emergency Evacuation Drill
  '89ce07e6-3b59-401c-b583-444a8d93f335'  -- Trustee Elections / Term Review
);
-- everything else stays at the column default, 'task': Emergency Contact
-- List Update, Community welfare register, Emergency communications plan,
-- Emergency food and supply kit, Fire Extinguisher Service, First Aid Kit
-- Inspection, Building & Contents Insurance, Public Liability Insurance.
