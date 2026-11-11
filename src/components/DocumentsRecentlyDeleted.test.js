import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.mock('../lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('../lib/useSortPreference', () => ({ useSortPreference: () => ['detailed', jest.fn()] }));
jest.mock('./CharterGenerator', () => () => null);
jest.mock('./HSPolicyGenerator', () => () => null);
jest.mock('./ViewToggle', () => () => null);
jest.mock('./ListRow', () => ({ __esModule: true, default: () => null, LIST_ROW_RESPONSIVE_CSS: '' }));

const mockUpdates = [];
let mockDocs = []; let mockTrash = [];
jest.mock('../lib/supabase', () => {
  const chain = (table) => {
    const state = { table, filters: [], op: 'select', payload: null };
    const api = {
      select: () => api,
      order: () => api,
      is: (c, v) => { state.filters.push(['is', c, v]); return api; },
      not: (c, o, v) => { state.filters.push(['not', c, v]); return api; },
      update: (p) => { state.op = 'update'; state.payload = p; return api; },
      delete: () => { state.op = 'delete'; return api; },
      eq: (c, v) => { if (state.op === 'update') mockUpdates.push({ table, payload: state.payload, id: v }); return api; },
      then: (res) => {
        let data = [];
        if (state.op === 'select' && table === 'documents') {
          data = state.filters.some(f => f[0] === 'not') ? mockTrash : mockDocs;
        }
        return Promise.resolve({ data, error: null }).then(res);
      },
    };
    return api;
  };
  return { supabase: {
    from: (t) => chain(t),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
  } };
});

import DocumentsManager from './DocumentsManager';

global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

let container, root;
beforeEach(() => {
  mockUpdates.length = 0;
  mockDocs = [{ id: 'd1', title: 'Fire plan', category: 'Health & Safety', file_name: 'f.pdf', file_url: 'x/f.pdf', entity_id: null, created_at: '2026-11-01T00:00:00Z' }];
  mockTrash = [{ id: 'd2', title: 'Old minutes', category: 'Governance', file_url: 'x/m.pdf', entity_id: null, deleted_at: new Date().toISOString() }];
  window.confirm = jest.fn(() => true);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('deleting hides the document by setting deleted_at, not by erasing it', async () => {
  await act(async () => { root.render(<DocumentsManager />); }); await flush();
  const del = [...container.querySelectorAll('button')].find(b => /delete|🗑/i.test(b.textContent) && !/Recently/.test(b.textContent));
  expect(del).toBeTruthy();
  await act(async () => { del.click(); }); await flush();
  const u = mockUpdates.find(x => x.id === 'd1');
  expect(u).toBeTruthy();
  expect(u.payload.deleted_at).toBeTruthy();
  expect(u.payload.deleted_by).toBe('u1');
});

test('Recently deleted lists trashed documents and Restore clears deleted_at', async () => {
  await act(async () => { root.render(<DocumentsManager />); }); await flush();
  const open = [...container.querySelectorAll('button')].find(b => /Recently deleted/.test(b.textContent));
  await act(async () => { open.click(); }); await flush();
  const rows = container.querySelectorAll('[data-testid="trash-row"]');
  expect(rows.length).toBe(1);
  expect(rows[0].textContent).toContain('Old minutes');
  expect(rows[0].textContent).toContain('30 days left');
  const restore = [...rows[0].querySelectorAll('button')].find(b => b.textContent === 'Restore');
  await act(async () => { restore.click(); }); await flush();
  const u = mockUpdates.find(x => x.id === 'd2');
  expect(u.payload).toEqual({ deleted_at: null, deleted_by: null });
});
