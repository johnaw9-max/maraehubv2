import { escapeHtml, formatDay, sortCompletions, buildEvidenceHtml, sourceLabel } from './complianceEvidence';

test('formatDay has no timezone shift', () => {
  expect(formatDay('2026-11-13')).toBe('13 Nov 2026');
  expect(formatDay('2026-01-01')).toBe('1 Jan 2026');
  expect(formatDay(null)).toBe('');
});

test('escapeHtml blocks markup in user-typed notes', () => {
  expect(escapeHtml('<script>alert(1)</script>"&\'')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;&#39;');
});

test('sortCompletions is newest first, ties by created_at', () => {
  const rows = [
    { id: 'a', done_on: '2026-05-01', created_at: '2026-05-01T01:00:00Z' },
    { id: 'b', done_on: '2026-11-01', created_at: '2026-11-01T01:00:00Z' },
    { id: 'c', done_on: '2026-11-01', created_at: '2026-11-01T02:00:00Z' },
  ];
  expect(sortCompletions(rows).map(r => r.id)).toEqual(['c', 'b', 'a']);
  expect(rows[0].id).toBe('a'); // input not mutated
});

test('evidence page escapes notes and names, and lists every row', () => {
  const html = buildEvidenceHtml({
    maraeName: 'Test <Marae>', itemName: 'Fire drill', legalBasis: 'Good practice',
    rows: [{ done_on: '2026-11-01', done_by: 'A & B', note: '<img src=x onerror=1>', document_name: 'cert.pdf', source: 'manual_backfill' }],
    generatedOn: '2026-11-13',
  });
  expect(html).toContain('Test &lt;Marae&gt;');
  expect(html).toContain('&lt;img src=x onerror=1&gt;');
  expect(html).not.toContain('<img src=x');
  expect(html).toContain('1 Nov 2026');
  expect(html).toContain('cert.pdf');
  expect(html).toContain(sourceLabel('manual_backfill'));
});

test('evidence page says so when nothing is recorded', () => {
  expect(buildEvidenceHtml({ itemName: 'X', rows: [], generatedOn: '2026-11-13' })).toContain('No completions recorded yet.');
});

import { buildMonthColumns, buildBoardRows } from './complianceEvidence';

test('month columns: 12 months ending this month, across a year boundary', () => {
  const cols = buildMonthColumns('2026-02-10', 12);
  expect(cols).toHaveLength(12);
  expect(cols[0].key).toBe('2025-03');
  expect(cols[11].key).toBe('2026-02');
  expect(cols[9].label).toBe('Dec');
});

test('board rows: last done, per-month counts, items with nothing recorded', () => {
  const months = buildMonthColumns('2026-11-13', 12);
  const items = [{ id: 'a' }, { id: 'b' }];
  const comps = [
    { compliance_item_id: 'a', done_on: '2026-11-01' },
    { compliance_item_id: 'a', done_on: '2026-11-09' },
    { compliance_item_id: 'a', done_on: '2025-01-05' }, // before the 12 shown months
  ];
  const rows = buildBoardRows(items, comps, months);
  expect(rows[0].lastDone).toBe('2026-11-09');
  expect(rows[0].total).toBe(3);
  expect(rows[0].monthCounts['2026-11']).toBe(2);
  expect(rows[0].monthCounts['2025-01']).toBeUndefined();
  expect(rows[1].lastDone).toBeNull();
  expect(rows[1].total).toBe(0);
});

import { buildGapSummary } from './complianceEvidence';

test('gap summary: overdue first, regular checks never recorded, nothing double counted', () => {
  const rows = [
    { item: { id: 'a', name: 'Fire alarm', renewal_months: 6 }, total: 0 },   // overdue AND no record -> overdue only
    { item: { id: 'b', name: 'Extinguishers', renewal_months: 12 }, total: 0 }, // no record
    { item: { id: 'c', name: 'Insurance', renewal_months: 12 }, total: 2 },    // fine
    { item: { id: 'd', name: 'One-off survey', renewal_months: null }, total: 0 }, // not a regular check
  ];
  const g = buildGapSummary(rows, i => (i.id === 'a' ? 'overdue' : 'compliant'));
  expect(g.overdue.map(i => i.id)).toEqual(['a']);
  expect(g.noRecord.map(i => i.id)).toEqual(['b']);
  expect(buildGapSummary([], () => 'compliant')).toEqual({ overdue: [], noRecord: [] });
});
