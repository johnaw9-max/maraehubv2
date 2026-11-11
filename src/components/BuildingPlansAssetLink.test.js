import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockData = {
  emergency_building_plans: [{ id: 'p1', entity_id: null, name: 'Wharenui', image_path: 'plans/x.jpg' }],
  emergency_plan_pins: [{ id: 'pin1', plan_id: 'p1', pin_type: 'fire_extinguisher', label: 'Kitchen', x_pct: 10, y_pct: 10, notes: null, asset_id: 'a1' }],
  assets: [{ id: 'a1', name: 'Fire Extinguishers' }],
  service_reminders: [{ asset_id: 'a1', type: 'Annual service', due_date: '2020-01-01' }],
};
jest.mock('../lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: table => ({ select: () => ({ order: () => Promise.resolve({ data: mockData[table], error: null }) }) }),
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://example.test/x.jpg' }, error: null }) }) },
  },
}));
// eslint-disable-next-line import/first
import BuildingPlans from './BuildingPlans';

test('a pin linked to an overdue asset shows its service status', async () => {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => { root.render(<BuildingPlans entities={[]} />); });
  await act(async () => {});
  const marker = div.querySelector('button[title^="Fire extinguisher"]');
  expect(marker.style.border).toContain('3px solid');
  await act(async () => { marker.click(); });
  const info = div.querySelector('[data-testid="pin-asset"]');
  expect(info.textContent).toContain('Fire Extinguishers');
  expect(info.textContent).toContain('overdue since');
  act(() => root.unmount());
});
