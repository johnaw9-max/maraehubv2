import { getWeightedCompliancePct } from './complianceStatus';

const ok = (stage) => ({ stage, last_checked_date: '2026-01-01' });
const open = (stage) => ({ stage, due_date: '2020-01-01' });

test('equals the plain percentage when nothing is staged', () => {
  expect(getWeightedCompliancePct([ok(null), ok(null), open(null), open(null)])).toBe(50);
});
test('an overdue Start here item outweighs healthy Later items', () => {
  // 1 overdue stage-1 (w3) vs 3 ok stage-3 (w1 each): 3/(3+3)=50, plain would be 75
  expect(getWeightedCompliancePct([open(1), ok(3), ok(3), ok(3)])).toBe(50);
});
test('null when nothing is assessed', () => {
  expect(getWeightedCompliancePct([{ stage: 1 }])).toBeNull();
});
