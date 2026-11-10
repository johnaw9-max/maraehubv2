import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRoom = { id: 'r1', name: 'Wharenui', x: 10, y: 10, w: 30, h: 20, shape: 'rect', color: '#DDEBF7' };
const mockPin = { id: 'pin-in', plan_id: 'plan-d', pin_type: 'exit', label: 'Front door', x_pct: 20, y_pct: 15, notes: null };
const mockPinOut = { id: 'pin-out', plan_id: 'plan-d', pin_type: 'exit', label: 'Gate', x_pct: 80, y_pct: 80, notes: null };
const mockDrawn = { id: 'plan-d', entity_id: null, name: 'Our marae', image_path: null, layout: [mockRoom] };

jest.mock('../lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: table => ({
      select: () => ({ order: () => Promise.resolve({ data: table === 'emergency_building_plans' ? [mockDrawn] : [mockPin, mockPinOut], error: null }) }),
      insert: (...a) => mockInsert(...a),
      update: (...a) => { mockUpdate(table, ...a); return { eq: () => Promise.resolve({ error: null }) }; },
    }),
    storage: { from: () => ({ createSignedUrl: jest.fn() }) },
  },
}));

// eslint-disable-next-line import/first
import BuildingPlans, { STARTER_LAYOUT, snapAxis } from './BuildingPlans';

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
  const layoutCall = mockUpdate.mock.calls.find(c => c[0] === 'emergency_building_plans');
  const saved = layoutCall[1].layout[0];
  expect(saved.x).toBeCloseTo(20);
  expect(saved.y).toBeCloseTo(20);
  expect(saved.w).toBe(30);
  // the pin inside the room moved by the same amount; the pin outside did not
  const pinCalls = mockUpdate.mock.calls.filter(c => c[0] === 'emergency_plan_pins');
  expect(pinCalls).toHaveLength(1);
  expect(pinCalls[0][1].x_pct).toBeCloseTo(30);
  expect(pinCalls[0][1].y_pct).toBeCloseTo(25);
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

test('snapAxis lines a box up with the page centre, thirds and other boxes, but only when close', () => {
  const guides = [0, 25, 100 / 3, 50, 200 / 3, 75, 100];
  // box 30 wide whose centre (34.3 + 15 = 49.3) is near the page centre
  expect(snapAxis(34.3, 30, guides).guide).toBe(50);
  expect(snapAxis(34.3, 30, guides).delta).toBeCloseTo(0.7);
  // far from every guide: no snap
  expect(snapAxis(10, 8, [0, 50, 100])).toBeNull();
  // resize mode only looks at the far edge
  expect(snapAxis(10, 39.5, [50], false).delta).toBeCloseTo(0.5);
  expect(snapAxis(10, 20, [30, 50], false).guide).toBe(30);
  // a neighbour's edge works as a guide
  expect(snapAxis(61.2, 20, [60]).guide).toBe(60);
});

test('dragging a box close to the centre clicks it to the centre', async () => {
  mockUpdate.mockClear();
  const { div, root } = await mount();
  await act(async () => { btn(div, 'Edit rooms').click(); });
  const canvas = div.querySelector('[data-testid="plan-canvas"]');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });
  const box = [...canvas.children].find(c => c.textContent.includes('Wharenui'));
  const fire = (el, type, x, y) => el.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }), { pointerId: 1 }));
  await act(async () => { fire(box, 'pointerdown', 200, 100); });
  await act(async () => { fire(canvas, 'pointermove', 443, 100); }); // +24.3% sideways, box centre lands at 49.3%
  await act(async () => { fire(canvas, 'pointerup', 443, 100); });
  const saved = mockUpdate.mock.calls.find(c => c[0] === 'emergency_building_plans')[1].layout[0];
  expect(saved.x).toBeCloseTo(35); // 35 + 30/2 = 50
  act(() => root.unmount());
});

test('the centre buttons centre a box on the page', async () => {
  mockUpdate.mockClear();
  const { div, root } = await mount();
  await act(async () => { btn(div, 'Edit rooms').click(); });
  const canvas = div.querySelector('[data-testid="plan-canvas"]');
  const box = [...canvas.children].find(c => c.textContent.includes('Wharenui'));
  const fire = (el, type) => el.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: 0, clientY: 0 }), { pointerId: 1 }));
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });
  await act(async () => { fire(box, 'pointerdown'); fire(canvas, 'pointerup'); }); // select it without moving
  await act(async () => { btn(div, 'Centre sideways').click(); });
  await act(async () => { btn(div, 'Centre up/down').click(); });
  const layoutCalls = mockUpdate.mock.calls.filter(c => c[0] === 'emergency_building_plans');
  const last = layoutCalls.at(-1)[1].layout[0];
  expect(last.x).toBeCloseTo(35); // (100 - 30) / 2
  expect(last.y).toBeCloseTo(40); // (100 - 20) / 2
  act(() => root.unmount());
});

test('checklist rows link to official guidance and show the free FENZ marae visit number', async () => {
  const { div, root } = await mount();
  await act(async () => { btn(div, 'What must a marae have?').click(); });
  const hrefs = [...div.querySelectorAll('a')].map(a => a.getAttribute('href'));
  expect(hrefs).toContain('https://fireandemergency.nz/home-fire-safety/marae-fire-safety');
  expect(hrefs.some(h => h.includes('worksafe.govt.nz'))).toBe(true);
  expect(div.textContent).toContain('0800 MAHUIKA');
  act(() => root.unmount());
});
