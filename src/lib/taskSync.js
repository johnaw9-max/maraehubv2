import { supabase } from './supabase';
import { updateWorkflowProgress } from './workflowEngine';

const RECURRING_MONTHS = { monthly: 1, quarterly: 3, biannual: 6, annual: 12, '2years': 24 };

function nextDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr + 'T12:00:00') - today) / 86400000);
}

export function parseSourceId(description) {
  const m = (description || '').match(/\[source_id:([^\]]+)\]/);
  return m ? m[1] : null;
}

export function parseSourceType(description) {
  const m = (description || '').match(/\[source_type:([^\]]+)\]/);
  return m ? m[1] : null;
}

// Creates an OVERDUE task only if no open/in-progress task with this exact title exists.
// Also cancels any open UPCOMING task for the same source item so the board stays clean.
export async function ensureTask({ title, description, assigned_to, due_date, priority }) {
  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('title', title)
    .in('status', ['open', 'in-progress'])
    .limit(1);
  if (existing && existing.length > 0) return;

  // Cancel any lingering UPCOMING task for the same source item
  const sourceId = parseSourceId(description);
  if (sourceId) {
    await supabase
      .from('tasks')
      .update({ status: 'cancelled' })
      .like('title', 'UPCOMING: %')
      .like('description', `%[source_id:${sourceId}]%`)
      .in('status', ['open', 'in-progress']);
  }

  await supabase.from('tasks').insert({
    title,
    description: description || '',
    assigned_to: assigned_to || null,
    due_date: due_date || null,
    priority: priority || 'High',
    status: 'open',
  });
}

// Creates an UPCOMING task (Medium priority) for an item approaching its due date.
// Deduplicates by [source_id] in description — avoids re-creating if one was recently dismissed.
// windowDays: how many days back to treat a completed UPCOMING task as "still dismissed".
export async function ensureUpcomingTask({ sourceId, sourceType, name, description, assigned_to, due_date, windowDays }) {
  // Skip if an open/in-progress UPCOMING task already exists for this source item
  const { data: open } = await supabase
    .from('tasks')
    .select('id')
    .like('title', 'UPCOMING: %')
    .like('description', `%[source_id:${sourceId}]%`)
    .in('status', ['open', 'in-progress'])
    .limit(1);
  if (open && open.length > 0) return;

  // Skip if a UPCOMING task for this item was completed within the trigger window
  // (trustee already acknowledged it — don't nag again until it goes overdue)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const { data: recentDone } = await supabase
    .from('tasks')
    .select('id')
    .like('title', 'UPCOMING: %')
    .like('description', `%[source_id:${sourceId}]%`)
    .eq('status', 'completed')
    .gte('completed_at', cutoff.toISOString())
    .limit(1);
  if (recentDone && recentDone.length > 0) return;

  const days = due_date ? daysUntil(due_date) : null;
  const suffix = days !== null ? ` — due in ${days} day${days !== 1 ? 's' : ''}` : '';
  const title = `UPCOMING: ${name}${suffix}`;

  await supabase.from('tasks').insert({
    title,
    description: `${description || ''} [source_type:${sourceType}] [source_id:${sourceId}]`.trim(),
    assigned_to: assigned_to || null,
    due_date: due_date || null,
    priority: 'Medium',
    status: 'open',
  });
}

// Role Setup completion (86d... Role Setup, 2026-09-20; generalized into
// role_configs 2026-09-24): creates each of the role's recurring
// compliance_items rows the same way every other recurring obligation in
// this app works (renewal_months + due_date, see ComplianceTracker.js's
// nextDueDate()) -- plain Mark Done, no auto-re-run of the workflow. A
// duty's cadence is either 'meeting_frequency' (read from
// workflow_instances.context_data, set by the Role Setup modal's "how
// often does your marae meet?" input, falling back to annual if somehow
// missing) or a fixed RECURRING_MONTHS key for duties that aren't
// meeting-linked. entity_id is looked up from trustee_entities only when
// the trustee has exactly one marae assignment; multi-entity trustees or
// unassigned trustees get a null entity_id, matching how compliance_items
// already treats entity_id as optional elsewhere in this codebase.
//
// Role metadata and duty definitions live in role_configs (not a
// hardcoded JS object) so Chairperson/Treasurer can go live with a data
// change once their real duties exist, no deploy required.
async function ensureRoleDuties(roleKey, roleName, trusteeProfileId, contextData) {
  if (!roleKey || !roleName) return;

  const { data: config } = await supabase
    .from('role_configs')
    .select('duties')
    .eq('role_key', roleKey)
    .maybeSingle();
  if (!config?.duties?.length) return;

  let entityId = null;
  if (trusteeProfileId) {
    const { data: assigned } = await supabase
      .from('trustee_entities')
      .select('entity_id')
      .eq('profile_id', trusteeProfileId);
    if (assigned && assigned.length === 1) entityId = assigned[0].entity_id;
  }

  for (const duty of config.duties) {
    const { data: existing } = await supabase
      .from('compliance_items')
      .select('id')
      .eq('name', duty.name)
      .eq('responsible_name', roleName)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const months = duty.cadence === 'meeting_frequency'
      ? (RECURRING_MONTHS[contextData?.meeting_frequency] || 12)
      : (RECURRING_MONTHS[duty.cadence] || 12);

    await supabase.from('compliance_items').insert({
      category: duty.category,
      name: duty.name,
      renewal_months: months,
      due_date: nextDate(months),
      responsible_name: roleName,
      entity_id: entityId,
      classification: 'task',
    });
  }
}

// Called when a task moves to 'completed'. Routes to the correct source action
// based on title prefix and [source_id] / [source_type] markers in description.
export async function onTaskCompleted(task) {
  if (task.workflow_instance_id) {
    await updateWorkflowProgress(task.workflow_instance_id);

    if (task.workflow_step_order != null) {
      const { data: inst } = await supabase
        .from('workflow_instances')
        .select('status, entity_name, entity_id, context_data, workflow_templates(name)')
        .eq('id', task.workflow_instance_id)
        .single();
      const templateName = inst?.workflow_templates?.name;
      // 'Secretary Role Setup' kept for backward compat: instances
      // started before the 2026-09-24 rename to the shared 'Role Setup'
      // template still carry the old name.
      const isRoleSetup = templateName === 'Role Setup' || templateName === 'Secretary Role Setup';
      // Triggers on the whole instance completing, not a fixed step
      // number, so each role's checklist can have a different step count.
      if (isRoleSetup && inst.status === 'complete') {
        // context_data is null for instances started before it existed
        // (and before any role but Secretary did) -- default accordingly.
        const roleKey = inst.context_data?.role_key || 'secretary';
        await ensureRoleDuties(roleKey, inst.entity_name, inst.entity_id, inst.context_data);
      }
    }
  }

  const title = task.title || '';
  const desc = task.description || '';
  const sourceId = parseSourceId(desc);
  const sourceType = parseSourceType(desc);

  // ── UPCOMING tasks — mark reviewed, do NOT advance due date ─────────────────
  if (title.startsWith('UPCOMING: ')) {
    // Only compliance has a meaningful "last_checked_date" to record
    if (sourceType === 'compliance' && sourceId) {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('compliance_items')
        .update({ last_checked_date: today, updated_at: new Date().toISOString() })
        .eq('id', sourceId);
    }
    // For project / service / goal: completing the task is the acknowledgment — no DB change
    return;
  }

  // ── COMPLIANCE OVERDUE (prefix "OVERDUE: ") ─────────────────────────────────
  if (title.startsWith('OVERDUE: ')) {
    let itemId = sourceId;
    let renewalMonths = null;

    if (itemId) {
      const { data } = await supabase
        .from('compliance_items').select('renewal_months').eq('id', itemId).single();
      if (data) renewalMonths = data.renewal_months;
    } else {
      // Fallback for older tasks that pre-date source_id embedding
      const name = title.slice('OVERDUE: '.length);
      const { data } = await supabase
        .from('compliance_items').select('id, renewal_months').eq('name', name).limit(1);
      if (data && data[0]) { itemId = data[0].id; renewalMonths = data[0].renewal_months; }
    }

    if (itemId) {
      const today = new Date().toISOString().split('T')[0];
      const updates = { last_checked_date: today, updated_at: new Date().toISOString() };
      if (renewalMonths) updates.due_date = nextDate(renewalMonths);
      await supabase.from('compliance_items').update(updates).eq('id', itemId);
    }
    return;
  }

  // ── PROJECTS (prefix "PROJECT: ") → move to review ──────────────────────────
  if (title.startsWith('PROJECT: ') && sourceId) {
    await supabase.from('projects')
      .update({ status: 'review' })
      .eq('id', sourceId)
      .neq('status', 'completed');
    return;
  }

  // ── SERVICE REMINDERS (prefix "SERVICE: ") → advance due date ───────────────
  if (title.startsWith('SERVICE: ') && sourceId) {
    const { data } = await supabase
      .from('service_reminders').select('recurring').eq('id', sourceId).single();
    if (data && data.recurring !== 'none') {
      const months = RECURRING_MONTHS[data.recurring];
      if (months) {
        await supabase.from('service_reminders')
          .update({ due_date: nextDate(months) }).eq('id', sourceId);
      }
    }
    return;
  }

  // ── MEETING ACTIONS (prefix "ACTION: ") → mark Completed ────────────────────
  if (title.startsWith('ACTION: ') && sourceId) {
    await supabase.from('meeting_actions')
      .update({ status: 'Completed' }).eq('id', sourceId);
    return;
  }

  // ── GOALS (prefix "GOAL: ") → move to in_progress ───────────────────────────
  if (title.startsWith('GOAL: ') && sourceId) {
    await supabase.from('goals')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', sourceId)
      .in('status', ['not_started', 'at_risk']);
    return;
  }

  // GRANT: — no auto-reset; grant workflow is manual

  // ── FINANCE (prefix "FINANCE: ") → acknowledges over-budget review ───────────
  if (title.startsWith('FINANCE: ')) {
    // No DB update — completing the task is the review acknowledgment.
    // A new task will be created next time Finance tab is visited if still over budget.
    return;
  }
}

// Reverse of onTaskCompleted -- closes any open/in-progress task linked to
// sourceId (via [source_id:] in its description) when the source item is
// marked done from its own screen instead of from the Task Board. Matches
// the same real behavior already proven in the other direction (ClickUp
// 86d44k63x).
export async function closeLinkedTask(sourceId) {
  if (!sourceId) return;
  const { data: openTasks } = await supabase
    .from('tasks')
    .select('id')
    .like('description', `%[source_id:${sourceId}]%`)
    .in('status', ['open', 'in-progress']);
  if (!openTasks || openTasks.length === 0) return;
  await supabase
    .from('tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .in('id', openTasks.map(t => t.id));
}

// Map a task title prefix to a source label and icon for Board View grouping.
// UPCOMING must be listed before OVERDUE so its prefix is matched first.
//
// action classifies what completing the task does, per Step 4's audit
// (14yhc7kutvv): 'actionable' writes back to the source item, 'reference'
// is acknowledgment-only (no source write), 'ambiguous' has no completion
// handling in onTaskCompleted at all -- currently only GRANT:, a real gap
// left as a separate decision rather than papered over here.
export const TASK_SOURCES = [
  { prefix: 'UPCOMING: ', label: 'Upcoming',        icon: '🟡', tab: 'tasks',      action: 'reference'  },
  { prefix: 'OVERDUE: ',  label: 'Compliance',       icon: '✅', tab: 'compliance', action: 'actionable' },
  { prefix: 'PROJECT: ',  label: 'Projects',          icon: '📋', tab: 'projects',   action: 'actionable' },
  { prefix: 'SERVICE: ',  label: 'Asset Services',    icon: '🔧', tab: 'assets',     action: 'actionable' },
  { prefix: 'ACTION: ',   label: 'Meeting Actions',   icon: '📝', tab: 'minutes',    action: 'actionable' },
  { prefix: 'GOAL: ',     label: 'Strategic Goals',   icon: '🎯', tab: 'goals',      action: 'actionable' },
  { prefix: 'GRANT: ',    label: 'Grants',            icon: '💰', tab: 'grants',     action: 'ambiguous'  },
  { prefix: 'FINANCE: ',  label: 'Finance',           icon: '📊', tab: 'finance',    action: 'reference'  },
];

export function taskSource(title) {
  return TASK_SOURCES.find(s => (title || '').startsWith(s.prefix)) || null;
}
