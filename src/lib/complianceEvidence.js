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

// Gap summary for the chairman: what is overdue, and which regular checks have never had
// a record. "No record" is not the same as "not done", so the wording in the UI stays neutral.
// statusOf is passed in (getItemComplianceStatus) to keep this file free of other imports.
export function buildGapSummary(rows, statusOf) {
  const overdue = [];
  const noRecord = [];
  for (const r of rows || []) {
    if (statusOf(r.item) === 'overdue') overdue.push(r.item);
    else if (r.item.renewal_months && r.total === 0) noRecord.push(r.item);
  }
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  return { overdue: overdue.sort(byName), noRecord: noRecord.sort(byName) };
}

// Printable one-page summary of the Maintenance History board, for a trustees' meeting.
// groups: [{ label, rows: [{ name, lastDone, dueDate, overdue, monthCounts }] }]
export function buildBoardPrintHtml({ maraeName, generatedOn, months, groups, gaps, recurringCount, withRecord }) {
  const list = (items) => items.map(i => `<li>${escapeHtml(i.name)}</li>`).join('');
  const gapHtml = (gaps.overdue.length === 0 && gaps.noRecord.length === 0)
    ? '<p>Nothing is overdue, and every regular check has a record.</p>'
    : `${gaps.overdue.length ? `<h3>Overdue (${gaps.overdue.length})</h3><ul>${list(gaps.overdue)}</ul>` : ''}
       ${gaps.noRecord.length ? `<h3>Regular checks with no record yet (${gaps.noRecord.length})</h3>
       <p class="note">It may have been done but not written down.</p><ul>${list(gaps.noRecord)}</ul>` : ''}`;
  const head = `<tr><th class="l">Item</th><th>Last done</th><th>Next due</th>${months.map(m => `<th>${escapeHtml(m.label)}</th>`).join('')}</tr>`;
  const body = groups.map(g => `<tr class="cat"><td colspan="${3 + months.length}">${escapeHtml(g.label)}</td></tr>` +
    g.rows.map(r => `<tr><td class="l">${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.lastDone ? formatDay(r.lastDone) : '—')}</td>
      <td class="${r.overdue ? 'od' : ''}">${escapeHtml(r.dueDate ? formatDay(r.dueDate) : '—')}</td>
      ${months.map(m => { const n = r.monthCounts[m.key] || 0; return `<td class="${n ? 'ok' : ''}">${n ? (n > 1 ? '✓' + n : '✓') : ''}</td>`; }).join('')}
    </tr>`).join('')).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Maintenance history — ${escapeHtml(maraeName || '')}</title>
<style>
  @page{size:A4 landscape;margin:12mm;}
  body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;}
  h1{font-size:20px;margin:0 0 2px;} h2{font-size:13px;font-weight:normal;color:#555;margin:0 0 12px;}
  h3{font-size:14px;margin:10px 0 2px;} ul{margin:2px 0 6px;padding-left:20px;font-size:12px;columns:2;} .note{font-size:11px;color:#666;margin:0;}
  table{border-collapse:collapse;width:100%;font-size:11px;margin-top:14px;} th,td{border:1px solid #bbb;padding:3px 4px;text-align:center;}
  th{background:#f0f0f0;} .l{text-align:left;} .cat td{background:#e6e6e6;font-weight:bold;text-align:left;}
  .ok{background:#e8f4ef;font-weight:bold;} .od{color:#b00020;font-weight:bold;} tr{page-break-inside:avoid;}
  .meta{font-size:11px;color:#666;margin-top:10px;}
</style></head><body>
<h1>Maintenance history</h1>
<h2>${escapeHtml(maraeName || '')} · ${escapeHtml(formatDay(generatedOn))} · ${recurringCount ? `${withRecord} of ${recurringCount} regular checks have a record in the last 12 months` : ''}</h2>
<h2 style="color:#222;font-size:15px;margin-bottom:0">Gaps to look at</h2>
${gapHtml}
<table><thead>${head}</thead><tbody>${body}</tbody></table>
<p class="meta">Generated from MaraeHub. A blank month means nothing was recorded, not necessarily that it was not done.</p>
</body></html>`;
}
