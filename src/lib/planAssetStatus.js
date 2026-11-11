// Works out the service status of an asset for display on a Building Plan pin.
// The earliest upcoming/overdue reminder wins. Pure function so it is easy to test.

const DAY = 86400000;

export function assetServiceStatus(assetId, reminders, today = new Date()) {
  if (!assetId) return null;
  const mine = (reminders || []).filter(r => r.asset_id === assetId && r.due_date);
  if (mine.length === 0) return { status: 'none' };
  const next = [...mine].sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(next.due_date + 'T12:00:00');
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((dueDay - start) / DAY);
  const status = days < 0 ? 'overdue' : days <= 30 ? 'due-soon' : 'ok';
  return { status, days, due: next.due_date, type: next.type };
}

export const STATUS_COLOURS = { overdue: '#c0392b', 'due-soon': '#d4871a', ok: '#2e7d4f', none: '#9aa' };

export function statusText(s) {
  if (!s) return '';
  if (s.status === 'none') return 'No service date set yet';
  const d = new Date(s.due + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  if (s.status === 'overdue') return `${s.type || 'Service'} overdue since ${d}`;
  if (s.status === 'due-soon') return `${s.type || 'Service'} due ${d}`;
  return `Next: ${s.type || 'service'} ${d}`;
}
