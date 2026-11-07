import { loadMaraeDisplay } from './maraeDisplay';

test('uses the database function when present', async () => {
  const sb = { rpc: async () => ({ data: [{ marae_name: 'Ōpeke', location: 'Whakatāne' }], error: null }) };
  expect(await loadMaraeDisplay(sb)).toEqual({ marae_name: 'Ōpeke', location: 'Whakatāne' });
});

test('falls back to the table when the function is missing', async () => {
  const sb = {
    rpc: async () => ({ data: null, error: { message: 'missing' } }),
    from: () => ({ select: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { marae_name: 'Terere', location: null } }) }) }) }),
  };
  expect(await loadMaraeDisplay(sb)).toEqual({ marae_name: 'Terere', location: null });
});

test('returns nulls when nothing can be read', async () => {
  const sb = {
    rpc: async () => ({ data: [], error: null }),
    from: () => ({ select: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  };
  expect(await loadMaraeDisplay(sb)).toEqual({ marae_name: null, location: null });
});
