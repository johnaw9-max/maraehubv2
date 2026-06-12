import { supabase } from './supabase';

const RECURRING_MONTHS = { monthly: 1, quarterly: 3, biannual: 6, annual: 12, '2years': 24 };

function nextDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function parseSourceId(description) {
  const m = (description || '').match(/\[source_id:([^\]]+)\]/);
  return m ? m[1] : null;
}

// Creates a task only if no open/in-progress task with this exact title already exists.
export async function ensureTask({ title, description, assigned_to, due_date, priority }) {
  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('title', title)
    .in('status', ['open', 'in-progress'])
    .limit(1);
  if (existing && existing.length > 0) return;
  await supabase.from('tasks').insert({
    title,
    description: description || '',
    assigned_to: assigned_to || null,
    due_date: due_date || null,
    priority: priority || 'High',
    status: 'open',
  });
}

// Called when a task moves to 'completed'. Resets the source record based on
// the task title prefix and the [source_id:uuid] marker embedded in description.
export async function onTaskCompleted(task) {
  const title = task.title || '';
  const sourceId = parseSourceId(task.description);

  // ── COMPLIANCE (prefix "OVERDUE: ") ─────────────────────────────────────────
  if (title.startsWith('OVERDUE: ')) {
    let itemId = sourceId;
    let renewalMonths = null;

    if (itemId) {
      const { data } = await supabase
        .from('compliance_items').select('renewal_months').eq('id', itemId).single();
      if (data) renewalMonths = data.renewal_months;
    } else {
      // Fallback for older tasks without source_id
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
}

// Map a task title prefix to a source label and icon for Board View grouping.
export const TASK_SOURCES = [
  { prefix: 'OVERDUE: ', label: 'Compliance',      icon: '✅', tab: 'compliance' },
  { prefix: 'PROJECT: ', label: 'Projects',         icon: '📋', tab: 'projects'  },
  { prefix: 'SERVICE: ', label: 'Asset Services',   icon: '🔧', tab: 'assets'    },
  { prefix: 'ACTION: ',  label: 'Meeting Actions',  icon: '📝', tab: 'minutes'   },
  { prefix: 'GOAL: ',    label: 'Strategic Goals',  icon: '🎯', tab: 'goals'     },
  { prefix: 'GRANT: ',   label: 'Grants',           icon: '💰', tab: 'grants'    },
];

export function taskSource(title) {
  return TASK_SOURCES.find(s => (title || '').startsWith(s.prefix)) || null;
}
