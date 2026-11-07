import { bundleInHtml, runningBundle, canAutoReload } from './NewVersionBanner';

test('reads the main bundle hash from index.html', () => {
  const html = '<script defer="defer" src="/static/js/main.edacc2b2.js"></script>';
  expect(bundleInHtml(html)).toBe('edacc2b2');
  expect(bundleInHtml('<html></html>')).toBeNull();
});

test('reads the running bundle from the page scripts', () => {
  document.body.innerHTML = '<script src="/static/js/main.abc123.js"></script>';
  expect(runningBundle()).toBe('abc123');
  document.body.innerHTML = '';
  expect(runningBundle()).toBeNull();
});

describe('canAutoReload', () => {
  const now = 10_000_000;
  const base = { now, lastTypedAt: -Infinity, lastActiveAt: now - 5000, hidden: false, held: false, lastAutoReloadAt: 0 };
  test('does not reload while the person is active', () => {
    expect(canAutoReload(base)).toBe(false);
  });
  test('reloads when the tab is in the background', () => {
    expect(canAutoReload({ ...base, hidden: true })).toBe(true);
  });
  test('reloads after a minute of idleness', () => {
    expect(canAutoReload({ ...base, lastActiveAt: now - 61000 })).toBe(true);
  });
  test('never reloads if they typed in the last 10 minutes, even when hidden', () => {
    expect(canAutoReload({ ...base, hidden: true, lastTypedAt: now - 9 * 60 * 1000 })).toBe(false);
    expect(canAutoReload({ ...base, hidden: true, lastTypedAt: now - 11 * 60 * 1000 })).toBe(true);
  });
  test('never reloads while a screen holds updates', () => {
    expect(canAutoReload({ ...base, hidden: true, held: true })).toBe(false);
  });
  test('does not reload twice within 2 minutes', () => {
    expect(canAutoReload({ ...base, hidden: true, lastAutoReloadAt: now - 60000 })).toBe(false);
    expect(canAutoReload({ ...base, hidden: true, lastAutoReloadAt: now - 130000 })).toBe(true);
  });
});
