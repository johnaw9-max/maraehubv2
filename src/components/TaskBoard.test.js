import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import TaskBoard from './TaskBoard';
import { __setTasks, __getFromCalls, __getUpdateCalls, __reset } from '../lib/supabase';

// react-dom/test-utils' act() needs this flag under React 18, same as
// @testing-library/react sets internally -- harmless to set directly here
// since that package isn't installed in this project.
global.IS_REACT_ACT_ENVIRONMENT = true;

// No @testing-library/react in this project yet -- react-dom/test-utils
// (shipped with react-dom, already a dependency) is enough for these three
// scenarios without adding a new package. jest.mock calls are hoisted above
// imports by babel-jest regardless of where they appear in the file, so this
// ordering (imports first, mock factory after) is the normal jest pattern.
jest.mock('../lib/supabase', () => {
  let tasksData = [];
  let fromCalls = [];
  let updateCalls = [];

  function builder(table) {
    let lastUpdateRecord = null;
    const b = {
      select: () => b,
      order: () => b,
      in: () => b,
      like: () => b,
      gte: () => b,
      limit: () => b,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      eq: (col, val) => {
        if (lastUpdateRecord && col === 'id') {
          lastUpdateRecord.eqId = val;
          lastUpdateRecord = null;
        }
        return b;
      },
      update: payload => {
        const record = { table, payload, eqId: undefined };
        updateCalls.push(record);
        lastUpdateRecord = record;
        return b;
      },
      insert: () => Promise.resolve({ data: null, error: null }),
      delete: () => b,
      then: resolve => resolve({ data: table === 'tasks' ? tasksData : [], error: null }),
    };
    return b;
  }

  return {
    supabase: {
      from: table => { fromCalls.push(table); return builder(table); },
      auth: { getUser: () => Promise.resolve({ data: { user: { email: 'test@example.com' } } }) },
    },
    __setTasks: t => { tasksData = t; },
    __getFromCalls: () => fromCalls,
    __getUpdateCalls: () => updateCalls,
    __reset: () => { tasksData = []; fromCalls = []; updateCalls = []; },
  };
});

const TASKS_FIXTURE = [
  { id: 't1', title: 'RISK: Faulty wiring review', status: 'open', priority: 'High', due_date: null, assigned_to: 'Alice Trustee' },
  { id: 't2', title: 'Fix the roof', status: 'open', priority: 'Medium', due_date: null, assigned_to: 'Bob Example' },
  // Overdue AND in-progress -- must surface only in the top "In progress"
  // group, never a second time in "Needs attention".
  { id: 't3', title: 'Write grant report', status: 'in-progress', priority: 'Medium', due_date: '2020-01-01', assigned_to: 'Carol Writer' },
  { id: 't4', title: 'Old finished task', status: 'completed', priority: 'Low', due_date: null, assigned_to: 'Dana Helper' },
];

let container;
let root;

beforeEach(() => {
  __reset();
  __setTasks(TASKS_FIXTURE.map(t => ({ ...t })));
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

async function renderBoard() {
  root = createRoot(container);
  await act(async () => {
    root.render(<TaskBoard />);
  });
}

function findRowByText(text) {
  const rows = Array.from(container.querySelectorAll('.list-row'));
  return rows.find(r => r.textContent.includes(text));
}

function getChipButton(row) {
  return Array.from(row.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || '').startsWith('Status:'));
}

// Excludes the chip's own trigger button -- its visible text can equal one
// of the dropdown's own option labels (e.g. current status "Open" vs the
// "Open" menu item), and document order would otherwise match the trigger
// first.
function getMenuButtonByLabel(row, label) {
  return Array.from(row.querySelectorAll('button')).find(
    b => b.textContent === label && !(b.getAttribute('aria-label') || '').startsWith('Status:')
  );
}

test('the List | Board toggle persists across remounts', async () => {
  await renderBoard();

  // List is the default -- list-only grouping text is present.
  expect(container.textContent).toContain('Needs attention');

  const boardButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Board');
  await act(async () => { Simulate.click(boardButton); });

  expect(container.textContent).toContain('In Progress');
  expect(localStorage.getItem('mh_sort_tasks_view')).toBe('board');

  // Unmount and render fresh, simulating a reload -- preference should stick.
  act(() => { root.unmount(); });
  container.remove();
  container = document.createElement('div');
  document.body.appendChild(container);
  await renderBoard();

  expect(container.textContent).toContain('In Progress');
});

test('the complete checkbox calls the existing status-change handler', async () => {
  await renderBoard();

  const row = findRowByText('Fix the roof');
  expect(row).toBeTruthy();
  const checkbox = row.querySelector('input[type="checkbox"]');
  expect(checkbox.checked).toBe(false);

  await act(async () => {
    Simulate.change(checkbox, { target: { checked: true } });
  });

  const updates = __getUpdateCalls();
  const taskUpdate = updates.find(u => u.table === 'tasks' && u.eqId === 't2');
  expect(taskUpdate).toBeTruthy();
  expect(taskUpdate.payload.status).toBe('completed');
  expect(taskUpdate.payload.completed_at).toBeTruthy();
});

test('a RISK task completes without writing to the risk', async () => {
  await renderBoard();

  const row = findRowByText('Faulty wiring review');
  expect(row).toBeTruthy();
  const checkbox = row.querySelector('input[type="checkbox"]');

  await act(async () => {
    Simulate.change(checkbox, { target: { checked: true } });
  });

  const updates = __getUpdateCalls();
  const taskUpdate = updates.find(u => u.table === 'tasks' && u.eqId === 't1');
  expect(taskUpdate).toBeTruthy();
  expect(taskUpdate.payload.status).toBe('completed');

  expect(__getFromCalls()).not.toContain('risk_register');
});

test('each of the four status chip choices calls the status handler', async () => {
  await renderBoard();

  expect(findRowByText('Fix the roof')).toBeTruthy();

  // Choosing a status runs the real changeTaskStatus, which calls
  // fetchTasks() -- that flips `loading` true then false, fully unmounting
  // and remounting the list. The row must be re-queried fresh each time;
  // a cached reference from a prior iteration is a detached DOM node and
  // Simulate.click on it is silently inert.
  const choices = [['Open', 'open'], ['In progress', 'in-progress'], ['Done', 'completed'], ['Cancelled', 'cancelled']];
  for (const [label, key] of choices) {
    const row = findRowByText('Fix the roof');
    await act(async () => { Simulate.click(getChipButton(row)); });
    await act(async () => { Simulate.click(getMenuButtonByLabel(row, label)); });

    const updates = __getUpdateCalls();
    const last = updates[updates.length - 1];
    expect(last.table).toBe('tasks');
    expect(last.eqId).toBe('t2');
    expect(last.payload.status).toBe(key);
  }
});

test('in-progress tasks show once, only in the top In progress group', async () => {
  await renderBoard();

  expect(container.textContent).toContain('In progress (1)');
  const inProgressHeaderIdx = container.textContent.indexOf('In progress (1)');
  const needsAttentionIdx = container.textContent.indexOf('Needs attention');
  expect(inProgressHeaderIdx).toBeLessThan(needsAttentionIdx);

  // Overdue AND in-progress -- must not also appear in Needs attention.
  const matches = Array.from(container.querySelectorAll('.list-row'))
    .filter(r => r.textContent.includes('Write grant report'));
  expect(matches.length).toBe(1);
});

test('reopening a task from the completed/cancelled group works', async () => {
  await renderBoard();

  const showCompletedButton = Array.from(container.querySelectorAll('button'))
    .find(b => b.textContent.includes('Show completed'));
  await act(async () => { Simulate.click(showCompletedButton); });

  const row = findRowByText('Old finished task');
  expect(row).toBeTruthy();

  await act(async () => { Simulate.click(getChipButton(row)); });
  await act(async () => { Simulate.click(getMenuButtonByLabel(row, 'Open')); });

  const updates = __getUpdateCalls();
  const reopen = updates.find(u => u.table === 'tasks' && u.eqId === 't4' && u.payload.status === 'open');
  expect(reopen).toBeTruthy();
});

test('regression (14yhc7kw7dt): the status chip word is a real word boundary in the row\'s copied text, not fused to a neighbour', async () => {
  await renderBoard();

  const row = findRowByText('Fix the roof');
  expect(row).toBeTruthy();
  // A naive substring check (row.textContent.includes('Open')) would
  // pass even if the chip's text were glued to its neighbours with no
  // separator -- a word-boundary match is what a real copy-paste or a
  // human reading the text actually needs. Found via the shared ListRow
  // component Compliance also uses; fixed there for both consumers.
  expect(row.textContent).toMatch(/(^|\s)Open(\s|$)/);
});
