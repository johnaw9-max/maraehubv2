// Builds the printable "evidence of completion" page for one compliance item.
// Pure functions (no React, no network) so they are easy to test.

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 2026-11-13 -> 13 Nov 2026 (no timezone shifts: parse the parts by hand).
export function formatDay(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return String(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

const SOURCE_LABEL = {
  done_button: 'Marked done in MaraeHub',
  manual_backfill: 'Added later from past records',
  carried_over: 'Carried over from earlier last-checked date',
};

export function sourceLabel(source) {
  return SOURCE_LABEL[source] || 'Recorded in MaraeHub';
}

// Newest first. Same-day rows: newest created first.
export function sortCompletions(rows) {
  return [...(rows || [])].sort((a, b) => {
    if (a.done_on !== b.done_on) return a.done_on < b.done_on ? 1 : -1;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export function buildEvidenceHtml({ maraeName, itemName, legalBasis, rows, generatedOn }) {
  const sorted = sortCompletions(rows);
  const body = sorted.length === 0
    ? '<p>No completions recorded yet.</p>'
    : `<table>
        <thead><tr><th>Date done</th><th>Done by</th><th>Note</th><th>Proof attached</th><th>Recorded as</th></tr></thead>
        <tbody>${sorted.map(r => `<tr>
          <td>${escapeHtml(formatDay(r.done_on))}</td>
          <td>${escapeHtml(r.done_by || '—')}</td>
          <td>${escapeHtml(r.note || '')}</td>
          <td>${escapeHtml(r.document_name || '—')}</td>
          <td>${escapeHtml(sourceLabel(r.source))}</td>
        </tr>`).join('')}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(itemName)} — evidence of completion</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:32px;}
  h1{font-size:20px;margin:0 0 4px;} h2{font-size:15px;font-weight:normal;color:#555;margin:0 0 18px;}
  table{border-collapse:collapse;width:100%;font-size:13px;} th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top;}
  th{background:#f0f0f0;} .meta{font-size:12px;color:#666;margin-top:18px;}
</style></head><body>
<h1>${escapeHtml(itemName)}</h1>
<h2>${escapeHtml(maraeName || '')}${legalBasis ? ' · ' + escapeHtml(legalBasis) : ''}</h2>
${body}
<p class="meta">Generated from MaraeHub on ${escapeHtml(formatDay(generatedOn))}. Records are kept as they were entered; proof files are stored in MaraeHub.</p>
</body></html>`;
}

// ── Maintenance History board helpers ─────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// The last `count` months ending with the month of `today` (YYYY-MM-DD), oldest first.
export function buildMonthColumns(today, count = 12) {
  const m = /^(\d{4})-(\d{2})/.exec(today);
  let year = Number(m[1]);
  let month = Number(m[2]); // 1-12
  const cols = [];
  for (let i = 0; i < count; i++) {
    cols.unshift({ key: `${year}-${String(month).padStart(2, '0')}`, label: MONTH_SHORT[month - 1], year });
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
  }
  return cols;
}

// One row per item: when it was last done (ever) and which of the shown months have a record.
export function buildBoardRows(items, completions, months) {
  const shown = new Set(months.map(c => c.key));
  const byItem = {};
  for (const c of completions || []) {
    (byItem[c.compliance_item_id] = byItem[c.compliance_item_id] || []).push(c);
  }
  return (items || []).map(item => {
    const rows = byItem[item.id] || [];
    let lastDone = null;
    const monthCounts = {};
    for (const r of rows) {
      if (!lastDone || r.done_on > lastDone) lastDone = r.done_on;
      const key = String(r.done_on).slice(0, 7);
      if (shown.has(key)) monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
    return { item, lastDone, total: rows.length, monthCounts };
  });
}
