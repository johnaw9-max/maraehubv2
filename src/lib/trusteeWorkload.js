// Single source of truth for "who has what" across every module that
// carries a free-text assignee field (not an FK to profiles):
// compliance_items.responsible_name, tasks.assigned_to, risk_register.owner,
// service_reminders.owner, meeting_actions.assigned_to, goals.responsible_name.
// Backs the workload rollup (Board View), bulk reassignment, and the
// handover pack (86d44q123, Steps 1/3/4).
import { supabase } from './supabase';

const SOURCES = [
  { module: 'Compliance', table: 'compliance_items', field: 'responsible_name',
    columns: 'id, name, due_date, responsible_name',
    label: r => r.name, dueDate: r => r.due_date, navTo: 'compliance',
    isOpen: () => true },
  { module: 'Tasks', table: 'tasks', field: 'assigned_to',
    columns: 'id, title, due_date, status, assigned_to',
    label: r => r.title, dueDate: r => r.due_date, navTo: 'tasks',
    isOpen: r => r.status !== 'cancelled' && r.status !== 'completed' },
  { module: 'Risk Register', table: 'risk_register', field: 'owner',
    columns: 'id, risk_description, review_date, status, owner',
    label: r => r.risk_description, dueDate: r => r.review_date, navTo: 'risks',
    isOpen: r => r.status !== 'Closed' },
  { module: 'Service Reminders', table: 'service_reminders', field: 'owner',
    columns: 'id, type, due_date, owner',
    label: r => r.type, dueDate: r => r.due_date, navTo: 'assets',
    isOpen: () => true },
  { module: 'Meeting Actions', table: 'meeting_actions', field: 'assigned_to',
    columns: 'id, description, due_date, status, assigned_to',
    label: r => r.description, dueDate: r => r.due_date, navTo: 'minutes',
    isOpen: r => r.status !== 'Completed' },
  { module: 'Goals', table: 'goals', field: 'responsible_name',
    columns: 'id, name, target_date, status, responsible_name',
    label: r => r.name, dueDate: r => r.target_date, navTo: 'goals',
    isOpen: r => r.status !== 'completed' },
];

function normalize(name) {
  return (name || '').trim().toLowerCase();
}

function today() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function isOverdue(dueDate) {
  return !!dueDate && new Date(dueDate + 'T12:00:00') < today();
}

// Task/action text in this app is free-form and sometimes multi-paragraph
// with embedded URLs (real data, not a hypothetical) -- collapse to a single
// readable line before it ever reaches the offboard list or the printed
// handover pack.
function cleanLabel(text) {
  if (!text) return text;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? flat.slice(0, 120).trimEnd() + '…' : flat;
}

// Pure: turns already-fetched raw rows (keyed by table name, any status)
// into a flat, normalized list of OPEN items carrying an assignee.
// Pass fullName to scope to one person (case-insensitive exact match on
// the free-text field); omit to get everyone, for the workload rollup.
export function normalizeItems(dataByTable, fullName = null) {
  const target = fullName ? normalize(fullName) : null;
  return SOURCES.flatMap(src => {
    const rows = dataByTable[src.table] || [];
    return rows
      .filter(src.isOpen)
      .filter(r => r[src.field])
      .filter(r => !target || normalize(r[src.field]) === target)
      .map(r => ({
        module: src.module,
        navTo: src.navTo,
        id: r.id,
        label: cleanLabel(src.label(r)),
        assignee: r[src.field],
        dueDate: src.dueDate(r) || null,
        overdue: isOverdue(src.dueDate(r)),
      }));
  });
}

// Async: fetches every assignee-bearing table fresh, for callers that don't
// already have this data loaded (e.g. MaraeSettings' offboarding/handover
// flows, which run on demand rather than on every page load).
export async function fetchAssignableItems(fullName = null) {
  const results = await Promise.all(SOURCES.map(async src => {
    const { data } = await supabase.from(src.table).select(src.columns);
    return { table: src.table, data: data || [] };
  }));
  const dataByTable = {};
  results.forEach(r => { dataByTable[r.table] = r.data; });
  return normalizeItems(dataByTable, fullName);
}

// Every resolution a trustee is linked to via meeting_actions.assigned_to,
// most recent first -- "decisions they were involved in" for the handover
// pack. Deliberately not scoped to open items only (a departing trustee's
// past decisions are exactly what the incoming person needs context on).
export async function fetchTrusteeDecisions(fullName) {
  const target = normalize(fullName);
  const { data: actions } = await supabase
    .from('meeting_actions')
    .select('assigned_to, resolution_id')
    .not('resolution_id', 'is', null);
  const resolutionIds = [...new Set(
    (actions || [])
      .filter(a => normalize(a.assigned_to) === target)
      .map(a => a.resolution_id)
  )];
  if (resolutionIds.length === 0) return [];
  const { data: resolutions } = await supabase
    .from('resolutions')
    .select('id, resolution_number, description, date_passed, status')
    .in('id', resolutionIds)
    .order('date_passed', { ascending: false });
  return resolutions || [];
}

// Groups open items by assignee, most-loaded first -- Step 1's workload/
// concentration view.
export function aggregateByAssignee(items) {
  const byName = new Map();
  items.forEach(item => {
    const key = normalize(item.assignee);
    if (!byName.has(key)) byName.set(key, { name: item.assignee, total: 0, overdue: 0, items: [] });
    const bucket = byName.get(key);
    bucket.total += 1;
    if (item.overdue) bucket.overdue += 1;
    bucket.items.push(item);
  });
  return Array.from(byName.values()).sort((a, b) => b.total - a.total || b.overdue - a.overdue);
}

// Bulk-updates every open item currently assigned to `fromName` so it's
// assigned to `toName` instead -- Step 3, reassignment on departure.
export async function reassignItems(items, toName) {
  const byTable = new Map();
  items.forEach(item => {
    const src = SOURCES.find(s => s.module === item.module);
    if (!src) return;
    if (!byTable.has(src.table)) byTable.set(src.table, { field: src.field, ids: [] });
    byTable.get(src.table).ids.push(item.id);
  });
  await Promise.all(Array.from(byTable.entries()).map(([table, { field, ids }]) =>
    supabase.from(table).update({ [field]: toName }).in('id', ids)
  ));
}
