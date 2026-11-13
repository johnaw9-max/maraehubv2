import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import RecordsExport from './RecordsExport';

const mockBuild = jest.fn();
const mockInsert = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { email: 'Trustee@Example.com' } } }) },
    from: () => ({ insert: (...a) => mockInsert(...a) }),
  },
}));
jest.mock('../lib/recordsExport', () => ({ buildRecordsExport: (...a) => mockBuild(...a) }));
jest.mock('../lib/audit', () => ({ logAudit: jest.fn() }));

let root, container, clicked;
beforeEach(() => {
  mockBuild.mockReset(); mockInsert.mockReset(); mockInsert.mockReturnValue(Promise.resolve({}));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  clicked = [];
  global.URL.createObjectURL = jest.fn(() => 'blob:fake');
  global.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicked.push(this.download); });
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });

const button = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('copy of our records'));

test('downloads the zip under the right name and says what was left out', async () => {
  mockBuild.mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    filename: 'maraehub-records-x-2026-11-14.zip',
    results: [
      { table: 'meetings', label: 'Hui and minutes', status: 'ok', rows: 4 },
      { table: 'finance_income', label: 'Finance: income', status: 'skipped', reason: 'not available to your login' },
    ],
  });
  await act(async () => { root.render(<RecordsExport maraeName="Te Marae" entityId="e1" />); });
  await act(async () => { Simulate.click(button()); });

  expect(mockBuild).toHaveBeenCalledTimes(1);
  expect(mockBuild.mock.calls[0][0].maraeName).toBe('Te Marae');
  expect(mockBuild.mock.calls[0][0].exportedBy).toBe('Trustee@Example.com');
  expect(clicked).toEqual(['maraehub-records-x-2026-11-14.zip']);
  expect(container.textContent).toContain('Downloaded: maraehub-records-x-2026-11-14.zip');
  expect(container.textContent).toContain('Left out: Finance: income (not available to your login)');
  expect(mockInsert).toHaveBeenCalledWith({ account_email: 'trustee@example.com', export_type: 'records_copy_zip', row_count: 4 });
});

test('if building fails, nothing downloads and the trustee sees why', async () => {
  mockBuild.mockRejectedValue(new Error('Could not read Hui and minutes: connection reset'));
  await act(async () => { root.render(<RecordsExport maraeName="Te Marae" />); });
  await act(async () => { Simulate.click(button()); });

  expect(clicked).toEqual([]);
  expect(container.querySelector('[role="alert"]').textContent).toContain('Could not read Hui and minutes');
  expect(button().disabled).toBe(false);
});
