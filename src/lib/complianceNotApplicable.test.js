import { isNotApplicable, getComplianceStatus } from './complianceStatus';

describe('not applicable items', () => {
  const item = (over = {}) => ({ id: over.id || 'a', name: 'X', due_date: null, last_checked_date: null, ...over });

  test('an item with not_applicable_at set is not applicable; others are', () => {
    expect(isNotApplicable(item({ not_applicable_at: '2026-11-22T00:00:00Z' }))).toBe(true);
    expect(isNotApplicable(item())).toBe(false);
    expect(isNotApplicable(item({ not_applicable_at: null }))).toBe(false);
    expect(isNotApplicable(null)).toBe(false);
  });

  test('filtering them out keeps them out of the never-assessed count', () => {
    const items = [
      item({ id: '1' }),
      item({ id: '2', not_applicable_at: '2026-11-22T00:00:00Z', not_applicable_reason: 'No employees' }),
      item({ id: '3', last_checked_date: '2026-11-01' }),
    ];
    const all = getComplianceStatus(items);
    const active = getComplianceStatus(items.filter(i => !isNotApplicable(i)));
    expect(all.neverAssessed).toHaveLength(2);
    expect(active.neverAssessed).toHaveLength(1);
    expect(active.total).toBe(2);
  });
});
