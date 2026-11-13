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

import { buildBoardPrintHtml } from './complianceEvidence';

test('board print page: escapes names, shows gaps and months', () => {
  const html = buildBoardPrintHtml({
    maraeName: 'Terere <Marae>', generatedOn: '2026-11-13',
    months: buildMonthColumns('2026-11-13', 12),
    gaps: { overdue: [{ name: 'Fire <b>alarm' }], noRecord: [] },
    recurringCount: 5, withRecord: 2,
    groups: [{ label: 'Fire', rows: [{ name: 'Alarm test', lastDone: '2026-10-11', dueDate: '2026-11-01', overdue: true, monthCounts: { '2026-10': 1 } }] }],
  });
  expect(html).toContain('Terere &lt;Marae&gt;');
  expect(html).toContain('Fire &lt;b&gt;alarm');
  expect(html).not.toContain('<b>alarm');
  expect(html).toContain('2 of 5 regular checks');
  expect(html).toContain('11 Oct 2026');
  expect(html).toContain('class="od"');
});

import { addMonthsISO, itemUpdatesForDone } from './complianceEvidence';

test('addMonthsISO: normal, year rollover, short months', () => {
  expect(addMonthsISO('2026-11-13', 6)).toBe('2027-05-13');
  expect(addMonthsISO('2026-11-13', 12)).toBe('2027-11-13');
  expect(addMonthsISO('2026-08-31', 6)).toBe('2027-02-28');
  expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonthsISO('bad', 1)).toBeNull();
});

test('one rule: newest done date updates Last checked and Next due; older goes to history only', () => {
  const item = { last_checked_date: '2026-09-01', due_date: '2027-03-01', renewal_months: 6 };
  expect(itemUpdatesForDone(item, '2026-10-11')).toEqual({ last_checked_date: '2026-10-11', due_date: '2027-04-11' });
  expect(itemUpdatesForDone(item, '2026-09-01')).toEqual({ last_checked_date: '2026-09-01', due_date: '2027-03-01' });
  expect(itemUpdatesForDone(item, '2026-05-01')).toBeNull();
  expect(itemUpdatesForDone({ renewal_months: null }, '2026-10-11')).toEqual({ last_checked_date: '2026-10-11' });
  expect(itemUpdatesForDone({ last_checked_date: null, renewal_months: 12 }, '2026-10-11')).toEqual({ last_checked_date: '2026-10-11', due_date: '2027-10-11' });
});
