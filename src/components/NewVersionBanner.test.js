import { bundleInHtml, runningBundle } from './NewVersionBanner';

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
