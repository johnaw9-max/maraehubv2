-- Risk -> Task -> Workflow automation (86d44k67n). Two independent
-- additions, one feature:
--
-- 1. A new "Risk Remediation Plan" template -- the ticket's own proposed
--    shape (Inspect -> Quote -> Decide -> Schedule -> Record), same
--    idempotent insert pattern as Water Contamination Response
--    (20260819040000). Deliberately ONE template, not one per risk
--    category: only Health & Safety has any real evidence of a
--    physical, inspectable risk right now (the real "roof leak" risk on
--    the test project); Financial/Governance/Environmental/Reputational
--    risks have zero real evidence a fixed Inspect->Quote shape fits
--    them at all, so no template/suggestion is built for those yet.
--
-- 2. risk_register.workflow_prompt_dismissed_at -- same shape as
--    compliance_items.risk_prompt_dismissed_at (86d44k66b) and
--    compliance_items.last_reminded_at before it -- the third real use
--    of this exact cooldown-column idiom in this codebase.

with new_template as (
  insert into public.workflow_templates (name, description, category)
  select
    'Risk Remediation Plan',
    'A structured response plan for a high-rated, physical risk -- inspect the real extent of the issue, get quotes, decide how to proceed, schedule the work, and record the outcome.',
    'maintenance'
  where not exists (
    select 1 from public.workflow_templates where name = 'Risk Remediation Plan'
  )
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description, requires_document, document_label)
select new_template.id, s.step_order, s.title, s.description, s.requires_document, s.document_label
from new_template
cross join (values
  (1, 'Inspect and assess', 'Assess the real extent of the issue on site -- what is actually wrong, how urgent it is, and any immediate safety measures needed in the meantime.', false, null),
  (2, 'Get quotes',         'Get quotes from qualified contractors or suppliers for repair, replacement, or remediation work.', false, null),
  (3, 'Decide',              'Review the quotes and options with trustees, decide how to proceed, and confirm budget.', false, null),
  (4, 'Schedule the work',   'Book the contractor or supplier, confirm a date, and let anyone affected know.', false, null),
  (5, 'Record the outcome',  'Record what was done, the cost, and any follow-up needed. Update the risk''s status and controls in the Risk Register to reflect the outcome.', false, null)
) as s(step_order, title, description, requires_document, document_label)
where new_template.id is not null;

alter table risk_register
  add column workflow_prompt_dismissed_at timestamp with time zone;
