import { recordCompletion } from './complianceCompletions';

const mockState = { existing: [], insertError: null, inserts: [] };

jest.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    from: table => {
      const b = {
        select: () => b, eq: () => b, limit: () => Promise.resolve({ data: mockState.existing, error: null }),
        maybeSingle: () => Promise.resolve({ data: table === 'profiles' ? { full_name: 'Waj' } : { entity_id: 'e1' }, error: null }),
        insert: row => { mockState.inserts.push({ table, row }); return Promise.resolve({ error: mockState.insertError }); },
      };
      return b;
    },
  },
}));

beforeEach(() => { mockState.existing = []; mockState.insertError = null; mockState.inserts = []; });

test('saves a history row with who and entity looked up', async () => {
  expect(await recordCompletion({ itemId: 'i1', doneOn: '2026-11-13' })).toBe(true);
  expect(mockState.inserts).toHaveLength(1);
  expect(mockState.inserts[0].row).toMatchObject({
    compliance_item_id: 'i1', done_on: '2026-11-13', done_by: 'Waj', done_by_user: 'u1', entity_id: 'e1', source: 'done_button',
  });
});

test('does not double-count when the same item was already marked done that day', async () => {
  mockState.existing = [{ id: 'x' }];
  expect(await recordCompletion({ itemId: 'i1', doneOn: '2026-11-13' })).toBe(true);
  expect(mockState.inserts).toHaveLength(0);
});

test('never throws: a failed save returns false', async () => {
  mockState.insertError = { message: 'relation "compliance_completions" does not exist' };
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(await recordCompletion({ itemId: 'i1', doneOn: '2026-11-13' })).toBe(false);
  warn.mockRestore();
});

test('no item id means nothing happens', async () => {
  expect(await recordCompletion({ itemId: null })).toBe(false);
  expect(mockState.inserts).toHaveLength(0);
});
