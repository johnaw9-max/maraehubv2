-- Classification pass for Opeke's real compliance_items, follow-up to
-- Stage 1 (20260817000000). Fresh assessment against Opeke's own 10
-- real items, not a reuse of Tineka's Stage 1 decisions -- Opeke's set
-- is smaller and differs by name.
--
-- Only 1 of 10 items gets reclassified. The other 4 that would be
-- 'workflow' under Tineka's identical name-matching logic (Evacuation
-- routes, Generator, Marae structure storm readiness, Water supply
-- tank) have NO matching workflow_template on Opeke -- those 4
-- templates were built in the same Stage 3 work that never reached
-- Opeke (86d41hgzx). Classifying them 'workflow' now would be
-- premature (Start Workflow button with nothing to link to), so they
-- correctly stay at the 'task' default until the templates exist here
-- too. No item matches the 'template' pattern either -- Opeke has
-- neither Building WoF nor Health & Safety Policy Review.

update public.compliance_items
set classification = 'workflow',
    workflow_template_id = 'f2f01cf3-e587-4ed8-8483-109f505099af' -- Civil Defence Emergency Plan Review (pre-existing on Opeke)
where id = 'df1d14de-8aa0-47c5-ad43-f6b4b9c6b027'; -- "Civil Defence Emergency Plan — reviewed and up to date"
