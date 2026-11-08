import { readSavedTab, saveTab, forgetSavedTab } from './tabMemory';

const KEYS = ['board', 'compliance', 'finance'];

beforeEach(() => window.sessionStorage.clear());

test('returns nothing when nothing has been saved', () => {
  expect(readSavedTab('u1', KEYS)).toBeNull();
});

test('puts a trustee back on the page they were on', () => {
  saveTab('u1', 'compliance');
  expect(readSavedTab('u1', KEYS)).toBe('compliance');
});

test('ignores a saved page the person can no longer open', () => {
  saveTab('u1', 'finance');
  expect(readSavedTab('u1', ['board', 'compliance'])).toBeNull();
});

test('ignores a saved page that no longer exists', () => {
  saveTab('u1', 'old-removed-page');
  expect(readSavedTab('u1', KEYS)).toBeNull();
});

test('does not carry over to a different person on the same tab', () => {
  saveTab('u1', 'compliance');
  expect(readSavedTab('u2', KEYS)).toBeNull();
});

test('forgetting clears it', () => {
  saveTab('u1', 'compliance');
  forgetSavedTab('u1');
  expect(readSavedTab('u1', KEYS)).toBeNull();
});

test('does nothing without a person id', () => {
  saveTab(undefined, 'compliance');
  expect(readSavedTab(undefined, KEYS)).toBeNull();
});
