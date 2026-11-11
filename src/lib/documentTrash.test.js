import { daysLeft, isExpired, permanentlyDelete, purgeExpired, TRASH_RETENTION_DAYS } from './documentTrash';

const DAY = 86400000;
const NOW = Date.parse('2026-11-12T00:00:00Z');

function fakeSupabase({ storageError = null, dbError = null } = {}) {
  const removed = []; const deleted = [];
  return {
    removed, deleted,
    storage: { from: () => ({ remove: async (paths) => { removed.push(...paths); return { error: storageError }; } }) },
    from: () => ({ delete: () => ({ eq: async (_c, id) => { deleted.push(id); return { error: dbError }; } }) }),
  };
}

test('daysLeft counts down from the retention window', () => {
  expect(daysLeft(new Date(NOW).toISOString(), NOW)).toBe(TRASH_RETENTION_DAYS);
  expect(daysLeft(new Date(NOW - 29 * DAY).toISOString(), NOW)).toBe(1);
  expect(daysLeft(new Date(NOW - 40 * DAY).toISOString(), NOW)).toBe(0);
});

test('isExpired only after the window', () => {
  expect(isExpired(new Date(NOW - 29 * DAY).toISOString(), NOW)).toBe(false);
  expect(isExpired(new Date(NOW - 31 * DAY).toISOString(), NOW)).toBe(true);
});

test('permanentlyDelete removes the stored file then the row', async () => {
  const sb = fakeSupabase();
  const r = await permanentlyDelete(sb, { id: 'd1', file_url: 'entity/abc.pdf' });
  expect(r.ok).toBe(true);
  expect(sb.removed).toEqual(['entity/abc.pdf']);
  expect(sb.deleted).toEqual(['d1']);
});

test('permanentlyDelete keeps the row when the file removal fails', async () => {
  const sb = fakeSupabase({ storageError: { message: 'nope' } });
  const r = await permanentlyDelete(sb, { id: 'd1', file_url: 'entity/abc.pdf' });
  expect(r.ok).toBe(false);
  expect(sb.deleted).toEqual([]);
});

test('permanentlyDelete does not touch storage for linked (external) documents', async () => {
  const sb = fakeSupabase();
  await permanentlyDelete(sb, { id: 'd2', file_url: 'https://example.com/x.pdf' });
  expect(sb.removed).toEqual([]);
  expect(sb.deleted).toEqual(['d2']);
});

test('purgeExpired only removes documents past the window', async () => {
  const sb = fakeSupabase();
  const n = await purgeExpired(sb, [
    { id: 'old', file_url: 'a.pdf', deleted_at: new Date(NOW - 45 * DAY).toISOString() },
    { id: 'new', file_url: 'b.pdf', deleted_at: new Date(NOW - 2 * DAY).toISOString() },
  ], NOW);
  expect(n).toBe(1);
  expect(sb.deleted).toEqual(['old']);
});
