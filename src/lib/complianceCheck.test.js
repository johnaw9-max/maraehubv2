import { summariseCheck, buildCheckBlock } from './complianceCheck';

const row = (o) => ({ name: 'x', category: 'water', framework_class: 'good_practice', status: 'not_yet_assessed', overdue: false, applicability_open: false, schedule_missing: false, framework_review_needed: false, ...o });

test('not applicable items are excluded from every count', () => {
  const s = summariseCheck([row({ status: 'not_applicable' }), row({ status: 'compliant' })]);
  expect(s).toMatchObject({ total: 2, notApplicable: 1, inScope: 1, compliant: 1 });
});

test('not yet assessed is counted separately and never as action required', () => {
  const s = summariseCheck([row({}), row({}), row({ status: 'action_required', overdue: true })]);
  expect(s.notYetAssessed).toBe(2);
  expect(s.actionRequired).toBe(1);
  expect(s.overdue).toBe(1);
});

test('overdue counts a past due date even when the item has never been assessed', () => {
  const s = summariseCheck([row({ status: 'not_yet_assessed', overdue: true })]);
  expect(s.overdue).toBe(1);
  expect(s.actionRequired).toBe(0);
});

test('open applicability, missing schedules and unmatched items are counted', () => {
  const s = summariseCheck([row({ applicability_open: true }), row({ schedule_missing: true }), row({ framework_review_needed: true })]);
  expect(s).toMatchObject({ applicabilityOpen: 1, scheduleMissing: 1, frameworkReviewNeeded: 1 });
});

test('empty or missing rows give zero counts, not an error', () => {
  expect(summariseCheck(null).total).toBe(0);
  expect(summariseCheck([]).overdue).toBe(0);
});

test('block lists overdue items oldest first and says not-assessed is not a failure', () => {
  const block = buildCheckBlock([
    row({ name: 'B item', overdue: true, due_date: '2026-10-01', status: 'action_required', framework_class: 'conditional_legal' }),
    row({ name: 'A item', overdue: true, due_date: '2026-09-01', status: 'action_required' }),
  ]);
  expect(block.indexOf('A item')).toBeLessThan(block.indexOf('B item'));
  expect(block).toContain('NOT a failure');
  expect(block).toContain('legal requirement if it applies');
  expect(block).toContain('OVERDUE ITEMS (2)');
});

test('block says none when nothing is overdue', () => {
  expect(buildCheckBlock([row({ status: 'compliant' })])).toContain('OVERDUE ITEMS: none.');
});

describe('source lines in the check block', () => {
  const { buildCheckBlock, buildSourceInfo } = require('./complianceCheck');
  const rows = [
    { id: 'a', name: 'Fire evacuation scheme', category: 'health_safety', framework_class: 'legal_requirement', status: 'action_required', overdue: true, due_date: '2026-01-01' },
    { id: 'b', name: 'Review hire terms', category: 'other', framework_class: 'good_practice', status: 'action_required', overdue: true, due_date: '2026-02-01' },
  ];
  const info = buildSourceInfo(
    [{ id: 'a', source_keys: ['FENZ'] }, { id: 'b', source_keys: [] }],
    [{ key: 'FENZ', name: 'Fire and Emergency NZ Act 2017', status: 'Verified', url: 'https://example.govt.nz/act', checked_on: '2026-11-20' }]
  );
  test('item with a source shows its name, date and link', () => {
    const t = buildCheckBlock(rows, info);
    expect(t).toMatch(/Fire evacuation scheme.*SOURCE: Fire and Emergency NZ Act 2017, checked by MaraeHub 2026-11-20, https:\/\/example\.govt\.nz\/act/);
  });
  test('item without a source says no source found', () => {
    expect(buildCheckBlock(rows, info)).toMatch(/Review hire terms.*no source found/);
    expect(buildCheckBlock(rows, info)).toMatch(/SOURCES: 1 of 2 items in scope have a recorded source; 1 have no source found/);
  });
  test('unsafe links are left out and nothing changes when no source info is given', () => {
    const bad = buildSourceInfo([{ id: 'a', source_keys: ['X'] }], [{ key: 'X', name: 'N', status: 'Verified', url: 'javascript:alert(1)' }]);
    expect(buildCheckBlock(rows, bad)).not.toMatch(/javascript:/);
    expect(buildCheckBlock(rows)).not.toMatch(/SOURCE/);
  });
});
