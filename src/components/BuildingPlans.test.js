import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const mockInsert = jest.fn();
const plan = { id: 'plan-1', entity_id: null, name: 'Wharenui', image_path: 'plans/x.jpg' };
const pin = { id: 'pin-1', plan_id: 'plan-1', pin_type: 'first_aid', label: 'Kitchen door', x_pct: 25, y_pct: 40, notes: null };

jest.mock('../lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: table => ({
      select: () => ({ order: () => Promise.resolve({ data: table === 'emergency_building_plans' ? [plan] : [pin], error: null }) }),
      insert: mockInsert,
    }),
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://example.test/x.jpg' }, error: null }) }) },
  },
}));

// eslint-disable-next-line import/first
import BuildingPlans from './BuildingPlans';

global.IS_REACT_ACT_ENVIRONMENT = true;

async function mount() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => { root.render(<BuildingPlans entities={[]} />); });
  await act(async () => {});
  return { div, root };
}

const setValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

test('shows the plan and existing pin', async () => {
  const { div, root } = await mount();
  expect(div.querySelector('img').getAttribute('src')).toBe('https://example.test/x.jpg');
  expect(div.textContent).toContain('Kitchen door');
  const marker = div.querySelector('button[title^="First aid kit"]');
  expect(marker.style.left).toBe('25%');
  expect(marker.style.top).toBe('40%');
  act(() => root.unmount());
});

test('a tap on the plan saves a pin at the right percentage position', async () => {
  mockInsert.mockResolvedValue({ error: null });
  const { div, root } = await mount();
  const img = div.querySelector('img');
  img.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 200 });

  const addBtn = [...div.querySelectorAll('button')].find(b => b.textContent.includes('Add a pin'));
  await act(async () => { addBtn.click(); });
  await act(async () => { img.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 100 })); });

  const labelInput = div.querySelector('input[placeholder^="e.g. Kitchen"]');
  await act(async () => { setValue(labelInput, 'Hall cupboard'); });
  const save = [...div.querySelectorAll('button')].find(b => b.textContent === 'Save');
  await act(async () => { save.click(); });

  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
    plan_id: 'plan-1', pin_type: 'first_aid', label: 'Hall cupboard', x_pct: 50, y_pct: 25,
  }));
  act(() => root.unmount());
});

test('a pin cannot be saved without a label', async () => {
  mockInsert.mockResolvedValue({ error: null });
  const { div, root } = await mount();
  const img = div.querySelector('img');
  img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  const addBtn = [...div.querySelectorAll('button')].find(b => b.textContent.includes('Add a pin'));
  await act(async () => { addBtn.click(); });
  await act(async () => { img.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 })); });
  const save = [...div.querySelectorAll('button')].find(b => b.textContent === 'Save');
  await act(async () => { save.click(); });
  expect(mockInsert).not.toHaveBeenCalled();
  expect(div.textContent).toContain('Say where it is');
  act(() => root.unmount());
});
