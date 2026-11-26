-- Applied live to the Ōpeke project on 26 Nov 2026 (via SQL editor, not the migration runner: its migration history table has no unique key).
-- Brings Ōpeke's schema to the same level as Terere: applicability columns, status view, AI usage log, monthly AI limit, audit view.
-- Wording was then copied by item name from Terere (same 54 items); a per-item hash of explanation, notes, basis, sources and class matched on both projects afterwards.
-- Ōpeke's own dates, owners, evidence and answers were not touched. AI drafting stays OFF for Ōpeke until its committee turns it on in Marae Settings.
alter table public.compliance_items
  add column if not exists applicability_test text,
  add column if not exists applies text not null default 'not_answered';
alter table public.marae_settings add column if not exists ai_monthly_limit integer not null default 30;
-- ai_usage_log, compliance_item_status and compliance_audit_flags: same definitions as 20261125060000, the Terere status view, and 20261126180000.
