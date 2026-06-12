import { supabase } from './supabase';

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

// Called when a task moves to 'completed'. Routes to the correct source action
// based on title prefix and [source_id] / [source_type] markers in description.
export async function onTaskCompleted(task) {
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

// Map a task title prefix to a source label and icon for Board View grouping.
// UPCOMING must be listed before OVERDUE so its prefix is matched first.
export const TASK_SOURCES = [
  { prefix: 'UPCOMING: ', label: 'Upcoming',        icon: '🟡', tab: 'tasks'      },
  { prefix: 'OVERDUE: ',  label: 'Compliance',       icon: '✅', tab: 'compliance' },
  { prefix: 'PROJECT: ',  label: 'Projects',          icon: '📋', tab: 'projects'   },
  { prefix: 'SERVICE: ',  label: 'Asset Services',    icon: '🔧', tab: 'assets'     },
  { prefix: 'ACTION: ',   label: 'Meeting Actions',   icon: '📝', tab: 'minutes'    },
  { prefix: 'GOAL: ',     label: 'Strategic Goals',   icon: '🎯', tab: 'goals'      },
  { prefix: 'GRANT: ',    label: 'Grants',            icon: '💰', tab: 'grants'     },
  { prefix: 'FINANCE: ',  label: 'Finance',           icon: '📊', tab: 'finance'    },
];

export function taskSource(title) {
  return TASK_SOURCES.find(s => (title || '').startsWith(s.prefix)) || null;
}
