-- Real, honest Role Setup audit (2026-09-20): Secretary is a governance
-- position that today exists only as free text (CommitteeMinutes fields)
-- and a dead "Add Trustee" dropdown (MaraeSettings.js's committeeRole ->
-- user_metadata, never read back anywhere). This gives the role a real,
-- functional onboarding process, matching the existing "Trustee Elections
-- and Term Review" governance-category workflow (20260816010000) --
-- same with-ins insert pattern, same workflow_templates/workflow_steps
-- shape consumed by src/lib/workflowEngine.js's startWorkflow().
--
-- Step 7's completion is handled specially in src/lib/taskSync.js's
-- onTaskCompleted() -- it creates the real recurring "Take Hui Minutes"
-- compliance_items row (category 'trustee', matching the existing
-- "Trustee Elections / Term Review" item already in that category;
-- monthly cadence per 2026-09-20 confirmation).

with ins as (
  insert into public.workflow_templates (name, description, category)
  values (
    'Secretary Role Setup',
    'Onboarding process for a trustee taking on the Secretary role: practical setup, learning the role, and establishing the recurring minute-taking duty.',
    'governance'
  )
  returning id
)
insert into public.workflow_steps (template_id, step_order, title, description)
select id, 1, 'Set up the marae as a new entity in MaraeHub', 'Confirm the marae''s details are entered under Settings before adding any records.' from ins
union all select id, 2, 'Add real trustees and committee members as contacts', '' from ins
union all select id, 3, 'Create the first real meeting record in Minutes', '' from ins
union all select id, 4, 'Try using Hui Mode during an actual meeting', '' from ins
union all select id, 5, 'Review the Secretary''s duties in the marae Charter', 'See the Charter Generator -- the Secretary clause covers appointment and term.' from ins
union all select id, 6, 'Shadow or debrief with an experienced trustee on minute-taking format', 'Skip if no one currently holds the role to learn from.' from ins
union all select id, 7, 'Set up the recurring "Take Hui Minutes" duty', 'Completing this step creates a monthly recurring compliance item so MaraeHub reminds you before each hui.' from ins;
