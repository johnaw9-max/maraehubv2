import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRoom = { id: 'r1', name: 'Wharenui', x: 10, y: 10, w: 30, h: 20, shape: 'rect', color: '#DDEBF7' };
const mockDrawn = { id: 'plan-d', entity_id: null, name: 'Our marae', image_path: null, layout: [mockRoom] };

jest.mock('../lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: table => ({
      select: () => ({ order: () => Promise.resolve({ data: table === 'emergency_building_plans' ? [mockDrawn] : [], error: null }) }),
      insert: (...a) => mockInsert(...a),
      update: (...a) => { mockUpdate(...a); return { eq: () => Promise.resolve({ error: null }) }; },
    }),
    storage: { from: () => ({ createSignedUrl: jest.fn() }) },
  },
}));

// eslint-disable-next-line import/first
import BuildingPlans, { STARTER_LAYOUT } from './BuildingPlans';

global.IS_REACT_ACT_ENVIRONMENT = true;

async function mount() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => { root.render(<BuildingPlans entities={[]} />); });
  await act(async () => {});
  return { div, root };
}
const btn = (div, text) => [...div.querySelectorAll('button')].find(b => b.textContent.includes(text));
const setValue = (el, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

test('the typical marae starter covers the usual buildings and stays on the canvas', () => {
  const names = STARTER_LAYOUT.map(r => r.name).join(' | ');
  ['Wharenui', 'Wharekai', 'Kitchen', 'Toilets', 'Marae ātea', 'Carpark'].forEach(n => expect(names).toContain(n));
  STARTER_LAYOUT.forEach(r => {
    expect(r.x + r.w).toBeLessThanOrEqual(100);
    expect(r.y + r.h).toBeLessThanOrEqual(100);
  });
});

test('draws a plan from the typical marae starter', async () => {
  mockInsert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new', name: 'Mine' }, error: null }) }) });
  const { div, root } = await mount();
  await act(async () => { btn(div, 'Draw a simple plan').click(); });
  await act(async () => { setValue(div.querySelector('input[placeholder="e.g. Our marae"]'), 'Mine'); });
  await act(async () => { btn(div, 'Create plan').click(); });
  const arg = mockInsert.mock.calls[0][0];
  expect(arg.name).toBe('Mine');
  expect(arg.image_path).toBeUndefined();
  expect(arg.layout).toHaveLength(STARTER_LAYOUT.length);
  expect(arg.layout.every(r => r.id && r.name)).toBe(true);
  act(() => root.unmount());
});

test('dragging a room moves it and saves the new position', async () => {
  mockUpdate.mockClear();
  const { div, root } = await mount();
  await act(async () => { btn(div, 'Edit rooms').click(); });
  const canvas = div.querySelector('[data-testid="plan-canvas"]');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });
  const box = [...canvas.children].find(c => c.textContent.includes('Wharenui'));
  const fire = (el, type, x, y) => el.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }), { pointerId: 1 }));
  await act(async () => { fire(box, 'pointerdown', 200, 100); });
  await act(async () => { fire(canvas, 'pointermove', 300, 150); }); // +10% x, +10% y
  await act(async () => { fire(canvas, 'pointerup', 300, 150); });
  const saved = mockUpdate.mock.calls.at(-1)[0].layout[0];
  expect(saved.x).toBeCloseTo(20);
  expect(saved.y).toBeCloseTo(20);
  expect(saved.w).toBe(30);
  act(() => root.unmount());
});

test('tapping a safety item then the plan opens the pin form with that item chosen', async () => {
  const { div, root } = await mount();
  await act(async () => { btn(div, 'Fire extinguisher').click(); });
  expect(div.textContent).toContain('Tap the plan where the fire extinguisher is.');
  const canvas = div.querySelector('[data-testid="plan-canvas"]');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  await act(async () => { canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 60 })); });
  expect(div.querySelector('select').value).toBe('fire_extinguisher');
  act(() => root.unmount());
});

test('the checklist shows what is missing and cites its sources', async () => {
  const { div, root } = await mount();
  expect(div.textContent).toContain('What must a marae have?');
  expect(div.textContent).toMatch(/items? the law may require/);
  await act(async () => { btn(div, 'What must a marae have?').click(); });
  expect(div.textContent).toContain('not legal advice');
  expect(div.textContent).toContain('Fire evacuation scheme');
  expect(div.querySelectorAll('a[href^="https://"]').length).toBeGreaterThanOrEqual(5);
  act(() => root.unmount());
});

test('generator and key box can be pinned, and the key box warns not to type a code', async () => {
  const { div, root } = await mount();
  expect(btn(div, 'Generator')).toBeTruthy();
  await act(async () => { btn(div, 'Key box / keys').click(); });
  const canvas = div.querySelector('[data-testid="plan-canvas"]');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  await act(async () => { canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 })); });
  expect(div.querySelector('select').value).toBe('key_box');
  expect(div.textContent).toContain('Never type a code or password');
  act(() => root.unmount());
});
