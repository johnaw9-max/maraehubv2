import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import ComplianceTracker from './ComplianceTracker';
import { getItemComplianceStatus } from '../lib/complianceStatus';
import { getStatusLabel, getColorKey, PILL_COLORS } from './StatusPill';
import { __reset, __setResponses, __getUpdateCalls } from '../lib/supabase';

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../lib/supabase', () => {
  let responses = {};
  let updateCalls = [];
  function builder(table) {
    const b = {
      select: () => b, order: () => b, is: () => b, not: () => b, like: () => b,
      gte: () => b, limit: () => b, in: () => b, eq: () => b,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      update: payload => { updateCalls.push({ table, payload }); return b; },
      insert: () => Promise.resolve({ data: null, error: null }),
      delete: () => b,
      then: resolve => resolve({ data: responses[table] || [], error: null }),
    };
    return b;
  }
  return {
    supabase: {
      from: table => builder(table),
      auth: { getUser: () => Promise.resolve({ data: { user: { email: 'test@example.com' } } }) },
    },
    __reset: () => { responses = {}; updateCalls = []; },
    __setResponses: r => { responses = r; },
    __getUpdateCalls: () => updateCalls,
  };
});

// One item per feature under test, both with an EP marker item present so
// seedEmergencyPreparedness's hasEP short-circuit fires instead of
// inserting its 7 seed rows, and a uniform 'tasks' row so taskSync's
// existence checks always find a match and skip inserting (same pattern
// as the earlier verification pass).
const WORKFLOW_ITEM = {
  id: 'w1', category: 'building', classification: 'workflow', name: 'Workflow Linked Item',
  due_date: null, last_checked_date: '2026-09-01', renewal_months: 12, responsible_name: null,
  notes: null, legal_basis: null, legal_basis_detail: null, entity_id: null,
  linked_service_reminder_id: null, linked_document_id: null, linked_expense_id: null,
  workflow_template_id: 'wf1', document_url: null, risk_prompt_dismissed_at: null,
};
const DOCUMENT_ITEM = {
  id: 'd1', category: 'insurance', classification: 'task', name: 'Document Linked Item',
  due_date: null, last_checked_date: '2026-09-01', renewal_months: 12, responsible_name: 'Alice Owner',
  notes: null, legal_basis: null, legal_basis_detail: null, entity_id: null,
  linked_service_reminder_id: null, linked_document_id: null, linked_expense_id: null,
  workflow_template_id: null, document_url: 'https://example.com/fire-cert.pdf', risk_prompt_dismissed_at: null,
};
const EP_MARKER = {
  id: 'ep1', category: 'emergency_preparedness', classification: 'task', name: 'EP Marker Item',
  due_date: null, last_checked_date: '2026-09-01', renewal_months: 12, responsible_name: null,
  notes: null, legal_basis: null, legal_basis_detail: null, entity_id: null,
  linked_service_reminder_id: null, linked_document_id: null, linked_expense_id: null,
  workflow_template_id: null, document_url: null, risk_prompt_dismissed_at: null,
};
const TASKS_FIXTURE = [{ id: 'tk1' }];

// jsdom (like real browsers) normalizes inline hex colors to rgb() on the
// CSSStyleDeclaration -- compare against that normalized form rather than
// the raw hex string from PILL_COLORS.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function daysFromToday(n) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const STATUS_BASE = {
  category: 'building', classification: 'task', notes: null, legal_basis: null, legal_basis_detail: null,
  entity_id: null, linked_service_reminder_id: null, linked_document_id: null, linked_expense_id: null,
  workflow_template_id: null, document_url: null, risk_prompt_dismissed_at: null,
};
const OVERDUE_ITEM = { ...STATUS_BASE, id: 's1', name: 'Overdue Status Item', due_date: daysFromToday(-10), last_checked_date: null, renewal_months: 12, responsible_name: 'Alice Owner' };
const DUE_SOON_ITEM = { ...STATUS_BASE, id: 's2', name: 'Due Soon Status Item', due_date: daysFromToday(10), last_checked_date: null, renewal_months: 12, responsible_name: 'Alice Owner' };
const COMPLIANT_ITEM = { ...STATUS_BASE, id: 's3', name: 'Compliant Status Item', due_date: daysFromToday(200), last_checked_date: '2026-09-01', renewal_months: 12, responsible_name: 'Alice Owner' };
const NOT_SET_ITEM = { ...STATUS_BASE, id: 's4', name: 'Not Set Status Item', due_date: null, last_checked_date: null, renewal_months: null, responsible_name: 'Alice Owner' };
const UNASSIGNED_ITEM = { ...STATUS_BASE, id: 's5', name: 'Unassigned Owner Item', due_date: daysFromToday(200), last_checked_date: '2026-09-01', renewal_months: 12, responsible_name: null };

let containers = [];

beforeEach(() => { localStorage.clear(); });

afterEach(() => {
  containers.forEach(({ root, container }) => {
    act(() => { root.unmount(); });
    container.remove();
  });
  containers = [];
});

async function renderTracker(props = {}, items = []) {
  __reset();
  __setResponses({ compliance_items: items, tasks: TASKS_FIXTURE });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<ComplianceTracker {...props} />); });
  containers.push({ root, container });
  return container;
}

function findRow(container, text) {
  return Array.from(container.querySelectorAll('.panel')).find(p => p.textContent.includes(text));
}

async function openMenu(row) {
  const menuButton = Array.from(row.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'More actions');
  await act(async () => { Simulate.click(menuButton); });
}

test('compact row "Start Workflow →" calls onStartWorkflow with the right payload', async () => {
  const onStartWorkflow = jest.fn();
  const container = await renderTracker({ onStartWorkflow }, [WORKFLOW_ITEM, EP_MARKER]);

  const row = findRow(container, 'Workflow Linked Item');
  expect(row).toBeTruthy();
  await openMenu(row);

  const startBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent.includes('Start Workflow'));
  expect(startBtn).toBeTruthy();
  await act(async () => { Simulate.click(startBtn); });

  expect(onStartWorkflow).toHaveBeenCalledTimes(1);
  expect(onStartWorkflow).toHaveBeenCalledWith({
    templateId: 'wf1',
    workflowName: 'Workflow Linked Item',
    sourceName: 'Workflow Linked Item',
    triggerType: 'renewal_reminder',
  });
});

test('compact row has no "Start Workflow" item when classification isn\'t workflow or onStartWorkflow is absent', async () => {
  const container = await renderTracker({}, [DOCUMENT_ITEM, EP_MARKER]);
  const row = findRow(container, 'Document Linked Item');
  await openMenu(row);
  const startBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent.includes('Start Workflow'));
  expect(startBtn).toBeUndefined();
});

test('compact row "View Document" links to the item\'s document_url', async () => {
  const container = await renderTracker({}, [DOCUMENT_ITEM, EP_MARKER]);

  const row = findRow(container, 'Document Linked Item');
  expect(row).toBeTruthy();
  await openMenu(row);

  const link = Array.from(row.querySelectorAll('a')).find(a => a.textContent.includes('View Document'));
  expect(link).toBeTruthy();
  expect(link.getAttribute('href')).toBe('https://example.com/fire-cert.pdf');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
});

test('the Incident Register section mounts with the new code', async () => {
  const container = await renderTracker({}, [EP_MARKER]);

  const incidentsTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Incident Register'));
  expect(incidentsTab).toBeTruthy();
  await act(async () => { Simulate.click(incidentsTab); });

  expect(container.textContent).toContain('Log Incident');
  expect(container.querySelector('.list-row')).toBeNull(); // incidents have no compact-list rendering of their own
});

test.each([
  ['overdue', OVERDUE_ITEM],
  ['due_soon', DUE_SOON_ITEM],
  ['compliant', COMPLIANT_ITEM],
])('compact row shows the %s chip word in the colour Detailed uses', async (expectedStatus, item) => {
  const container = await renderTracker({}, [item]);
  const row = findRow(container, item.name);
  expect(row).toBeTruthy();

  const actualStatus = getItemComplianceStatus(item);
  expect(actualStatus).toBe(expectedStatus);
  const label = getStatusLabel(actualStatus);
  const expectedColors = PILL_COLORS[getColorKey(actualStatus)];

  // Leaf span only -- the flexShrink wrapper around the chip also has
  // textContent === label (it bubbles up from its child), so a plain
  // textContent match would grab the wrapper instead of StatusPill's own
  // pill span, which is the one that actually carries color/background.
  const chip = Array.from(row.querySelectorAll('span')).find(s => s.textContent === label && s.children.length === 0);
  expect(chip).toBeTruthy();
  expect(chip.style.color).toBe(hexToRgb(expectedColors.color));
  expect(chip.style.background).toBe(hexToRgb(expectedColors.bg));
  // Never shrunk away in a crowded flex row -- the wrapping span around
  // the chip carries this, not StatusPill itself (which stays identical
  // for its six other callers).
  expect(chip.parentElement.style.flexShrink).toBe('0');
});

test.each([
  ['overdue', OVERDUE_ITEM],
  ['due_soon', DUE_SOON_ITEM],
  ['compliant', COMPLIANT_ITEM],
])('regression (14yhc7kw7dt): the %s chip word is a real word boundary in the row\'s copied text, not fused to a neighbour', async (expectedStatus, item) => {
  const container = await renderTracker({}, [item]);
  const row = findRow(container, item.name);
  const label = getStatusLabel(getItemComplianceStatus(item));

  // A naive substring check (`row.textContent.includes(label)`) passes
  // even when the chip's text is glued to its neighbours with no
  // separator -- that false confidence is exactly what let this bug
  // through earlier. A word-boundary match is what a real browser's
  // plain-text copy, or a human reading it, actually needs.
  const wordBoundaryRegex = new RegExp(`(^|\\s)${label}(\\s|$)`);
  expect(row.textContent).toMatch(wordBoundaryRegex);
});

test('a not_set item is bucketed under Never Assessed and shows its chip word once expanded', async () => {
  const container = await renderTracker({}, [NOT_SET_ITEM]);
  expect(getItemComplianceStatus(NOT_SET_ITEM)).toBe('not_set');

  const neverAssessedBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Never Assessed'));
  expect(neverAssessedBtn).toBeTruthy();
  await act(async () => { Simulate.click(neverAssessedBtn); });

  const row = findRow(container, NOT_SET_ITEM.name);
  expect(row).toBeTruthy();
  const label = getStatusLabel('not_set');
  expect(row.textContent).toMatch(new RegExp(`(^|\\s)${label}(\\s|$)`));
});

test('the compact marker button reads "Mark done" with an accessible label, and still calls the same handler', async () => {
  const container = await renderTracker({}, [OVERDUE_ITEM]);
  const row = findRow(container, OVERDUE_ITEM.name);
  const markDoneBtn = Array.from(row.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Mark this item as checked');

  expect(markDoneBtn).toBeTruthy();
  expect(markDoneBtn.textContent).toBe('Mark done');
  expect(markDoneBtn.textContent).not.toContain('✓');

  await act(async () => { Simulate.click(markDoneBtn); });
  const updates = __getUpdateCalls();
  const itemUpdate = updates.find(u => u.table === 'compliance_items');
  expect(itemUpdate).toBeTruthy();
  // Matches handleMarkDone's own expression exactly (today's real moment,
  // not a zeroed-midnight reconstruction, which can land on a different
  // UTC day in a timezone ahead of UTC).
  expect(itemUpdate.payload.last_checked_date).toBe(new Date().toISOString().split('T')[0]);
});

test('compact row shows owner initials, or "Unassigned" in muted text when there is none', async () => {
  const containerWithOwner = await renderTracker({}, [OVERDUE_ITEM]);
  const rowWithOwner = findRow(containerWithOwner, OVERDUE_ITEM.name);
  expect(rowWithOwner.textContent).toContain('AO'); // Alice Owner -> AO
  expect(rowWithOwner.textContent).not.toContain('Unassigned');

  const containerUnassigned = await renderTracker({}, [UNASSIGNED_ITEM]);
  const rowUnassigned = findRow(containerUnassigned, UNASSIGNED_ITEM.name);
  expect(rowUnassigned.textContent).toContain('Unassigned');
});
