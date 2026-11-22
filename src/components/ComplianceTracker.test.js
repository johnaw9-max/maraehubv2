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

// Documents are private storage files, so "View Document" opens a signed link
// on click (openSignedUrl) instead of linking straight to the raw document_url.
// The menu must offer it only when the item has a document.
test('compact row menu offers "View Document" as a button, and only when the item has a document', async () => {
  const container = await renderTracker({}, [DOCUMENT_ITEM, WORKFLOW_ITEM, EP_MARKER]);

  const docRow = findRow(container, 'Document Linked Item');
  expect(docRow).toBeTruthy();
  await openMenu(docRow);
  const docBtn = Array.from(docRow.querySelectorAll('button')).find(b => b.textContent.includes('View Document'));
  expect(docBtn).toBeTruthy();
  // No raw link to the stored file in the row.
  const rawLink = Array.from(docRow.querySelectorAll('a')).find(a => (a.getAttribute('href') || '').includes('fire-cert.pdf'));
  expect(rawLink).toBeUndefined();

  const wfRow = findRow(container, 'Workflow Linked Item');
  expect(wfRow).toBeTruthy();
  await openMenu(wfRow);
  const noDocBtn = Array.from(wfRow.querySelectorAll('button')).find(b => b.textContent.includes('View Document'));
  expect(noDocBtn).toBeUndefined();
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

// ── Stages (Start here / Next / Later) ──────────────────────────────────────
describe('compliance stages', () => {
  const STAGE1 = { ...OVERDUE_ITEM, id: 'st1', name: 'Stage One Item', stage: 1 };
  const STAGE2 = { ...DUE_SOON_ITEM, id: 'st2', name: 'Stage Two Item', stage: 2 };

  test('no stage tabs when no item has a stage', async () => {
    const c = await renderTracker({}, [EP_MARKER, OVERDUE_ITEM, DUE_SOON_ITEM]);
    expect(c.querySelector('[data-testid="stage-tab-1"]')).toBeNull();
    expect(c.textContent).toContain('Overdue Status Item');
    expect(c.textContent).toContain('Due Soon Status Item');
  });

  test('opens on Start here when items are staged, and tabs switch the list', async () => {
    // every item staged (the marker gets a stage too), so the list opens on Start here
    const c = await renderTracker({}, [{ ...EP_MARKER, stage: 3 }, STAGE1, STAGE2]);
    expect(c.querySelector('[data-testid="stage-tab-1"]').textContent).toContain('Start here (1)');
    expect(c.textContent).toContain('Stage One Item');
    expect(c.textContent).not.toContain('Stage Two Item');

    await act(async () => { Simulate.click(c.querySelector('[data-testid="stage-tab-2"]')); });
    expect(c.textContent).toContain('Stage Two Item');
    expect(c.textContent).not.toContain('Stage One Item');

    await act(async () => { Simulate.click(c.querySelector('[data-testid="stage-tab-all"]')); });
    expect(c.textContent).toContain('Stage One Item');
    expect(c.textContent).toContain('Stage Two Item');
  });
});

describe('not applicable, with a reason', () => {
  const NA_BASE = { ...STATUS_BASE, due_date: null, last_checked_date: null, renewal_months: null, responsible_name: null };
  const NEW_ITEM = { ...NA_BASE, id: 'n1', name: 'Charities annual return item' };
  const NA_ITEM = { ...NA_BASE, id: 'n2', name: 'Employer duty item', not_applicable_at: '2026-11-22T00:00:00Z', not_applicable_reason: 'We have no employees', not_applicable_by: 'Test Trustee' };

  test('a not-applicable item is out of the never-assessed list and shown, with its reason, in its own section', async () => {
    const c = await renderTracker({}, [EP_MARKER, NEW_ITEM, NA_ITEM]);
    expect(c.textContent).toContain('Never Assessed — 1 item');
    expect(c.textContent).toContain('Not applicable to us — 1 item');
    // the item sits only in the not-applicable section (collapsed by default, so its reason is not yet on screen)
    expect(c.textContent).not.toContain('Employer duty item');
    const toggle = Array.from(c.querySelectorAll('button')).find(b => b.textContent.includes('Not applicable to us'));
    await act(async () => { Simulate.click(toggle); });
    expect(c.textContent).toContain('Employer duty item');
    expect(c.textContent).toContain('We have no employees');
    expect(c.textContent).toContain('Recorded by Test Trustee');
  });

  test('marking an item not applicable needs a reason, then saves reason and time without deleting anything', async () => {
    const c = await renderTracker({}, [EP_MARKER, NEW_ITEM]);
    const never = Array.from(c.querySelectorAll('button')).find(b => b.textContent.includes('Never Assessed'));
    await act(async () => { Simulate.click(never); });
    await act(async () => { Simulate.click(c.querySelector('[data-testid="mark-not-applicable"]')); });
    // empty reason is refused
    await act(async () => { Simulate.click(c.querySelector('[data-testid="confirm-not-applicable"]')); });
    expect(c.textContent).toContain('Please give a reason');
    expect(__getUpdateCalls().some(u => u.payload.not_applicable_at)).toBe(false);
    const box = c.querySelector('[data-testid="not-applicable-reason"]');
    await act(async () => { Simulate.change(box, { target: { value: 'Our land is not a Māori reservation' } }); });
    await act(async () => { Simulate.click(c.querySelector('[data-testid="confirm-not-applicable"]')); });
    const call = __getUpdateCalls().find(u => u.payload.not_applicable_at);
    expect(call).toBeTruthy();
    expect(call.payload.not_applicable_reason).toBe('Our land is not a Māori reservation');
    expect(call.payload.due_date).toBeUndefined();
  });
});

describe('mixed staged and unstaged items', () => {
  const BASE = { ...STATUS_BASE, due_date: null, last_checked_date: '2026-11-01', renewal_months: 12, responsible_name: null };
  test('opens on All so older unstaged items are not hidden behind the Start here tab', async () => {
    const c = await renderTracker({}, [
      EP_MARKER,
      { ...BASE, id: 'm1', name: 'Older item without a stage', stage: null },
      { ...BASE, id: 'm2', name: 'Newer staged item', stage: 1 },
    ]);
    expect(c.textContent).toContain('Older item without a stage');
    expect(c.textContent).toContain('Newer staged item');
  });
});

describe('sources on an item', () => {
  const BASE = { ...STATUS_BASE, due_date: null, last_checked_date: null, renewal_months: null, responsible_name: null };
  const SOURCES = [
    { key: 'BA04', name: 'Building Act 2004', provisions_read: 'ss 105, 108', version_and_date_read: 'as at 8 Oct 2026; read 22 Nov 2026', status: 'Verified – primary source', url: 'https://www.legislation.govt.nz/act/public/2004/0072/latest/whole.html', notes: null },
    { key: 'MRR94', name: 'Maori Reservations Regulations 1994', provisions_read: 'regs 4, 6, 7', version_and_date_read: 'version 10; read 22 Nov 2026', status: 'Verified – primary source', url: '', notes: null },
  ];

  async function renderWithSources(items) {
    __reset();
    __setResponses({ compliance_items: items, tasks: TASKS_FIXTURE, legal_sources: SOURCES });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<ComplianceTracker />); });
    containers.push({ root, container });
    return container;
  }
  const open = async (c, name) => {
    const never = Array.from(c.querySelectorAll('button')).find(b => b.textContent.includes('Never Assessed'));
    await act(async () => { Simulate.click(never); });
    const row = findRow(c, name);
    const clickable = Array.from(row.querySelectorAll('div')).find(d => d.textContent.includes(name) && d.onclick !== undefined) || row.firstChild;
    await act(async () => { Simulate.click(row.querySelector('[role="button"]') || clickable); });
  };

  test('shows name, version and date, status and the official link, and tags the row', async () => {
    const c = await renderWithSources([EP_MARKER, { ...BASE, id: 's1', name: 'Warrant item', legal_basis: 'Building Act 2004', source_keys: ['BA04'] }]);
    await open(c, 'Warrant item');
    expect(c.querySelector('[data-testid="item-source-tag"]').textContent).toBe('Source checked');
    const block = c.querySelector('[data-testid="item-source-BA04"]');
    expect(block.textContent).toContain('Building Act 2004');
    expect(block.textContent).toContain('as at 8 Oct 2026; read 22 Nov 2026');
    expect(block.textContent).toContain('Verified – primary source');
    expect(block.querySelector('a').getAttribute('href')).toContain('legislation.govt.nz');
  });

  test('a source with no link says so instead of inventing one', async () => {
    const c = await renderWithSources([EP_MARKER, { ...BASE, id: 's2', name: 'Reservation item', legal_basis: 'Reg 6', source_keys: ['MRR94'] }]);
    await open(c, 'Reservation item');
    const block = c.querySelector('[data-testid="item-source-MRR94"]');
    expect(block.querySelector('a')).toBeNull();
    expect(block.textContent).toContain('Official link to be added');
  });

  test('an item with no sources shows an honest note and no tag, and an old database without the column still works', async () => {
    const c = await renderWithSources([EP_MARKER, { ...BASE, id: 's3', name: 'Practice item', legal_basis: 'Good practice (no law requires it)' }]);
    await open(c, 'Practice item');
    expect(c.querySelector('[data-testid="item-source-tag"]')).toBeNull();
    expect(c.querySelector('[data-testid="item-sources-none"]').textContent).toContain('No source recorded');
  });
});
