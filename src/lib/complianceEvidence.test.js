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
