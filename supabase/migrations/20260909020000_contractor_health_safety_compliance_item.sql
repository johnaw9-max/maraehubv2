-- Real, honest Post #10 audit finding: MaraeHub had a genuinely good
-- "Contractor Vetting and Approval" workflow template (10 real steps --
-- qualifications, public liability, H&S plan, references, site induction,
-- trustee approval, approved-contractor list, site access, close-out) but
-- zero compliance-side tracking for contractor safety at all, and on Opeke
-- (the real customer) no health_safety category items at all.
--
-- Deliberately NOT a per-contractor checklist item -- that is what the
-- workflow already does (see ContactsManager.js's new "Start Vetting
-- Workflow" button). This is the governance-level obligation the workflow
-- does not cover: periodically confirming the marae's own contractor-
-- vetting *process* is current, matching how "Health & Safety Policy
-- Review" below is policy-level, not per-incident.
--
-- Same seed pattern as the original compliance_items seed
-- (20260611084210_create_compliance_tables.sql).

insert into compliance_items (category, name, renewal_months) values
  ('health_safety', 'Contractor Health & Safety Management Review', 12)
on conflict do nothing;
