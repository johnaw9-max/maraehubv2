// Phase 1, item 9 (P1-09): AI notice, per-use tick box, admin off switch.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { MeetingDetail } from './CommitteeMinutes';
import { __reset, __setAiSetting, __getInvokes } from '../lib/supabase';

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../lib/supabase', () => {
  let aiSetting = { ai_drafting_enabled: true };
  let invokes = [];
  function builder(table) {
    let cols = '';
    const b = {
      select: c => { cols = c || ''; return b; },
      order: () => b, is: () => b, not: () => b, like: () => b, gte: () => b, lte: () => b,
      limit: () => b, in: () => b, eq: () => b, neq: () => b, or: () => b, ilike: () => b,
      single: () => Promise.resolve({ data: table === 'marae_settings' ? { marae_name: 'Test Marae' } : null, error: null }),
      maybeSingle: () => Promise.resolve(
        table === 'marae_settings' && cols.includes('ai_drafting_enabled') ? { data: aiSetting, error: null } : { data: null, error: null }),
      update: () => b, insert: () => b, delete: () => b, upsert: () => b,
      then: (resolve) => resolve({ data: [], error: null }),
    };
    return b;
  }
  return {
    supabase: {
      from: t => builder(t),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1', email: 't@example.com' } } }), getSession: () => Promise.resolve({ data: { session: null } }) },
      functions: { invoke: (name, opts) => { invokes.push({ name, opts }); return Promise.resolve({ data: { draft: { minutes: 'Draft', resolutions: [], actions: [] } }, error: null }); } },
      channel: () => ({ on: function () { return this; }, subscribe: function () { return this; } }),
      removeChannel: () => {},
    },
    __reset: () => { aiSetting = { ai_drafting_enabled: true }; invokes = []; },
    __setAiSetting: s => { aiSetting = s; },
    __getInvokes: () => invokes.filter(i => i.name === 'draft-minutes'),
  };
});

const MEETING = { id: 'm1', title: 'Hui ā-tau', meeting_type: 'Trustee', meeting_date: '2026-11-01', minutes: '', attachment_url: null };

async function render() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      <MeetingDetail meeting={MEETING} onBack={() => {}} onEdit={() => {}} onDelete={() => {}} documents={[]} onStartHuiMode={() => {}} />
    );
  });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return container;
}
const findButton = (c, text) => Array.from(c.querySelectorAll('button')).find(b => b.textContent.includes(text));

beforeEach(() => __reset());

test('notice is shown and Draft with AI stays disabled until the box is ticked', async () => {
  const c = await render();
  await act(async () => { Simulate.click(findButton(c, 'Draft from Hui Notes')); });
  expect(c.querySelector('[data-testid="ai-notice"]').textContent).toContain("Anthropic's Claude AI service");
  expect(c.querySelector('[data-testid="ai-notice"]').textContent).toContain('outside New Zealand');
  const textarea = c.querySelector('textarea');
  await act(async () => { Simulate.change(textarea, { target: { value: 'Agreed to get 2 quotes.' } }); });
  const draftBtn = findButton(c, 'Draft with AI');
  expect(draftBtn.disabled).toBe(true);
  await act(async () => { Simulate.click(draftBtn); });
  expect(__getInvokes().length).toBe(0);
});

test('after ticking, notes are sent once with consent, and the box resets for next time', async () => {
  const c = await render();
  await act(async () => { Simulate.click(findButton(c, 'Draft from Hui Notes')); });
  await act(async () => { Simulate.change(c.querySelector('textarea'), { target: { value: 'Agreed to get 2 quotes.' } }); });
  const box = c.querySelector('[data-testid="ai-consent"]');
  await act(async () => { Simulate.change(box, { target: { checked: true } }); });
  const draftBtn = findButton(c, 'Draft with AI');
  expect(draftBtn.disabled).toBe(false);
  await act(async () => { Simulate.click(draftBtn); });
  expect(__getInvokes()).toHaveLength(1);
  expect(__getInvokes()[0].name).toBe('draft-minutes');
  expect(__getInvokes()[0].opts.body.aiConsent).toBe(true);
  expect(c.querySelector('[data-testid="ai-consent"]').checked).toBe(false);
});

test('when the admin has switched AI drafting off, the option is not shown', async () => {
  __setAiSetting({ ai_drafting_enabled: false });
  const c = await render();
  expect(findButton(c, 'Draft from Hui Notes')).toBeUndefined();
});

test('opt-in (D-09): before the setting exists or is turned on, the option is not shown', async () => {
  __setAiSetting(null);
  const c = await render();
  expect(findButton(c, 'Draft from Hui Notes')).toBeUndefined();
});
