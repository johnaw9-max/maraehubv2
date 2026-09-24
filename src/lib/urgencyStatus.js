export const URGENCY_ORDER = { overdue: 0, due_soon: 1, upcoming: 2, no_date: 3, done: 4 };

export function getUrgencyStatus(item, { dateField = 'due_date', dueSoonDays, doneStatuses = [] } = {}) {
  if (doneStatuses.includes(item.status)) return 'done';
  const dateVal = item[dateField];
  if (!dateVal) return 'no_date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateVal + 'T12:00:00');
  if (due < today) return 'overdue';
  const windowEnd = new Date(today); windowEnd.setDate(windowEnd.getDate() + dueSoonDays);
  if (due <= windowEnd) return 'due_soon';
  return 'upcoming';
}

export function compareByUrgency(a, b, opts) {
  const ua = URGENCY_ORDER[getUrgencyStatus(a, opts)];
  const ub = URGENCY_ORDER[getUrgencyStatus(b, opts)];
  if (ua !== ub) return ua - ub;
  const dateField = opts?.dateField || 'due_date';
  if (a[dateField] && b[dateField]) return new Date(a[dateField]) - new Date(b[dateField]);
  if (a[dateField]) return -1;
  if (b[dateField]) return 1;
  return new Date(b.created_at) - new Date(a.created_at);
}
