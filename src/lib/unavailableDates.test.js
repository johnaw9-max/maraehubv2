import { firstClash, upcomingRanges, loadUnavailable } from './unavailableDates';

const ranges = [
  { from: '2026-12-04', to: '2026-12-06', kind: 'booked' },
  { from: '2026-11-27', to: '2026-11-29', kind: 'blocked' },
  { from: '2026-10-01', to: '2026-10-02', kind: 'booked' },
];

test('finds the first overlapping range, including touching days', () => {
  expect(firstClash(ranges, '2026-12-06', '2026-12-08').kind).toBe('booked');
  expect(firstClash(ranges, '2026-12-07', '2026-12-08')).toBeNull();
  expect(firstClash(ranges, '2026-11-28', null).kind).toBe('blocked');
  expect(firstClash(ranges, '', '')).toBeNull();
});

test('lists upcoming ranges soonest first and drops finished ones', () => {
  const u = upcomingRanges(ranges, '2026-11-08');
  expect(u.map(r => r.from)).toEqual(['2026-11-27', '2026-12-04']);
});

test('uses the database function when present', async () => {
  const sb = { rpc: async () => ({ data: [{ from_date: '2026-12-01', to_date: '2026-12-02', kind: 'booked' }], error: null }) };
  expect(await loadUnavailable(sb)).toEqual([{ from: '2026-12-01', to: '2026-12-02', kind: 'booked' }]);
});

test('falls back to reading the tables when the function is missing', async () => {
  const q = (rows) => ({ select: () => ({ eq: async () => ({ data: rows }), then: undefined }) });
  const sb = {
    rpc: async () => ({ data: null, error: { message: 'missing' } }),
    from: (t) => t === 'bookings'
      ? { select: () => ({ eq: async () => ({ data: [{ id: 'a', start_date: '2026-12-01', end_date: null }, { id: 'me', start_date: '2026-12-09', end_date: '2026-12-10' }] }) }) }
      : { select: async () => ({ data: [{ from_date: '2026-12-20', to_date: '2026-12-21' }] }) },
  };
  const r = await loadUnavailable(sb, 'me');
  expect(r).toEqual([
    { from: '2026-12-01', to: '2026-12-01', kind: 'booked' },
    { from: '2026-12-20', to: '2026-12-21', kind: 'blocked' },
  ]);
});
