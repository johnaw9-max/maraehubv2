import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import BookingEditModal from './BookingEditModal';

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdate = jest.fn();
const mockEq = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ update: c => { mockUpdate(c); return { eq: mockEq }; } }) },
}));
jest.mock('../lib/unavailableDates', () => ({ loadUnavailable: jest.fn(async () => []), firstClash: jest.fn(() => null) }));
jest.mock('../lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('../lib/notify', () => ({ sendNotification: jest.fn(), getTrusteeEmails: jest.fn() }));
const { getTrusteeEmails } = require('../lib/notify');

const booking = { id: 'b1', entity_id: 'e1', reference: 'MH-1', occasion: 'Tangihanga', start_date: '2026-12-01', end_date: '2026-12-02', guests: 40, overnight: true, facilities: [], status: 'approved', notes: null };

async function mount(props) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => { root.render(<BookingEditModal booking={booking} onClose={() => {}} {...props} />); });
  return div;
}
const clickSave = async (div, label) => {
  const btn = [...div.querySelectorAll('button')].find(b => b.textContent === label);
  await act(async () => { btn.click(); });
};

test('trustee edit keeps status and saves contact fields', async () => {
  mockEq.mockResolvedValue({ error: null });
  const onSaved = jest.fn();
  const div = await mount({ asTrustee: true, onSaved });
  const label = [...div.querySelectorAll('label')].find(l => l.textContent === 'Contact name');
  const input = label.parentElement.querySelector('input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Hera');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickSave(div, 'Save changes');
  expect(onSaved).toHaveBeenCalled();
  const changes = mockUpdate.mock.calls[0][0];
  expect(changes.status).toBeUndefined();
  expect(changes.contact_name).toBe('Hera');
});

test('member edit still resubmits as pending', async () => {
  mockEq.mockResolvedValue({ error: null });
  getTrusteeEmails.mockResolvedValue([]);
  window.confirm = jest.fn(() => true);
  const div = await mount({ onSaved: () => {} });
  await clickSave(div, 'Save and resubmit');
  expect(mockUpdate.mock.calls[0][0].status).toBe('pending');
});
