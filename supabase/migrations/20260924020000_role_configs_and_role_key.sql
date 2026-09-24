-- Generalize Role Setup (2026-09-24 design): ONE shared 'Role Setup'
-- workflow_templates row instead of one per role, with workflow_steps
-- distinguished by the new role_key column -- reuses the existing
-- workflow engine/admin step editor rather than a parallel mechanism.
-- Role metadata (label/icon/active) and the machine-actionable
-- recurring duties (name/category/cadence) move into this new
-- role_configs table, replacing the previously hardcoded
-- ROLES/ROLE_SETUP_CONFIG JS objects -- see src/components/RoleSetup.js
-- and src/lib/taskSync.js. Onboarding checklist step CONTENT stays in
-- workflow_steps -- only Secretary has real steps today; Chairperson/
-- Treasurer steps are a future content addition, not schema work.

create table if not exists role_configs (
  role_key text primary key,
  label text not null,
  icon text,
  is_active boolean not null default false,
  duties jsonb not null default '[]'::jsonb
);

alter table role_configs enable row level security;

create policy "authenticated users manage role_configs"
  on role_configs for all
  to public
  using ((auth.role() = 'authenticated'::text));

create policy "authenticated users view role_configs"
  on role_configs for select
  to public
  using ((auth.role() = 'authenticated'::text));

insert into role_configs (role_key, label, icon, is_active, duties) values
  ('secretary', 'Secretary', '📝', true,
    '[{"name": "Take Hui Minutes", "category": "trustee", "cadence": "meeting_frequency"}]'::jsonb),
  ('chairperson', 'Chairperson', '🏛️', false, '[]'::jsonb),
  ('treasurer', 'Treasurer', '💰', false, '[]'::jsonb)
on conflict (role_key) do nothing;

-- Fold the per-role template into one shared "Role Setup" template.
-- Existing in-flight instances reference template_id directly and were
-- already materialized into real tasks at start time, so this rename is
-- safe -- see the 2026-09-24 design note on workflow_instances being a
-- one-time snapshot, not a live join.
update workflow_templates
  set name = 'Role Setup',
      description = 'Onboarding process for a trustee taking on a committee role: practical setup, learning the role, and establishing its recurring duties.'
  where name = 'Secretary Role Setup';

alter table workflow_steps add column if not exists role_key text;

update workflow_steps ws
  set role_key = 'secretary'
  from workflow_templates wt
  where ws.template_id = wt.id and wt.name = 'Role Setup' and ws.role_key is null;

-- NULLs never conflict under a unique constraint, so this is a no-op for
-- every other template's steps (role_key always null there) and only
-- enforces per-role step_order uniqueness within Role Setup itself.
alter table workflow_steps
  add constraint workflow_steps_template_role_step_key
  unique (template_id, role_key, step_order);
