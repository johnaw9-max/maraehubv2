import { assetServiceStatus, statusText } from './planAssetStatus';

const today = new Date(2026, 10, 11);
const r = (asset_id, due_date, type = 'Service') => ({ asset_id, due_date, type });

test('no asset linked gives nothing', () => expect(assetServiceStatus(null, [], today)).toBeNull());
test('asset without reminders', () => expect(assetServiceStatus('a', [r('b', '2027-01-01')], today).status).toBe('none'));
test('overdue', () => expect(assetServiceStatus('a', [r('a', '2026-11-10')], today).status).toBe('overdue'));
test('due today is due soon, not overdue', () => expect(assetServiceStatus('a', [r('a', '2026-11-11')], today).status).toBe('due-soon'));
test('within 30 days is due soon', () => expect(assetServiceStatus('a', [r('a', '2026-12-11')], today).status).toBe('due-soon'));
test('later is ok', () => expect(assetServiceStatus('a', [r('a', '2027-01-01')], today).status).toBe('ok'));
test('earliest reminder wins', () => {
  const s = assetServiceStatus('a', [r('a', '2027-06-01', 'Later'), r('a', '2026-11-01', 'Sooner')], today);
  expect(s.type).toBe('Sooner');
  expect(s.status).toBe('overdue');
});
test('text mentions overdue', () => expect(statusText(assetServiceStatus('a', [r('a', '2026-11-01', 'Alarm test')], today))).toMatch(/overdue since/));
