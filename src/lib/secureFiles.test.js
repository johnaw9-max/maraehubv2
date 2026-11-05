// Phase 1, item 2 (P1-02) — Release 1 tests for the signed-link helper.
import { storagePathFromValue, signedHref, removeStoredFile, openStoredFile } from './secureFiles';
import { supabase } from './supabase';

jest.mock('./supabase', () => {
  const bucketApi = { createSignedUrl: jest.fn(), remove: jest.fn() };
  return { supabase: { storage: { from: () => bucketApi }, __bucketApi: bucketApi } };
});

const api = supabase.__bucketApi;
const BASE = 'https://abcd.supabase.co/storage/v1/object';

beforeEach(() => {
  // CRA resets mock implementations between tests, so set them here.
  api.createSignedUrl.mockReset();
  api.remove.mockReset();
  api.remove.mockResolvedValue({ error: null });
});

describe('storagePathFromValue', () => {
  test('old public address in the documents bucket', () => {
    expect(storagePathFromValue('documents', `${BASE}/public/documents/documents/1700-Fire_Cert.pdf`))
      .toBe('documents/1700-Fire_Cert.pdf');
  });
  test('public addresses in the other three buckets', () => {
    expect(storagePathFromValue('compliance-docs', `${BASE}/public/compliance-docs/items/1-a.pdf`)).toBe('items/1-a.pdf');
    expect(storagePathFromValue('finance-receipts', `${BASE}/public/finance-receipts/r/2-b.jpg`)).toBe('r/2-b.jpg');
    expect(storagePathFromValue('emergency-response-evidence', `${BASE}/public/emergency-response-evidence/e/3-c.png`)).toBe('e/3-c.png');
  });
  test('encoded characters are decoded', () => {
    expect(storagePathFromValue('documents', `${BASE}/public/documents/documents/1-T%C4%81ne.pdf`)).toBe('documents/1-Tāne.pdf');
  });
  test('signed address and bare path are both understood', () => {
    expect(storagePathFromValue('finance-receipts', `${BASE}/sign/finance-receipts/r/2-b.jpg?token=x`)).toBe('r/2-b.jpg');
    expect(storagePathFromValue('documents', 'documents/9-x.pdf')).toBe('documents/9-x.pdf');
  });
  test('external links and other buckets are not treated as our files', () => {
    expect(storagePathFromValue('documents', 'https://www.waikatodistrict.govt.nz/docs/template.pdf')).toBeNull();
    expect(storagePathFromValue('documents', `${BASE}/public/finance-receipts/r/2-b.jpg`)).toBeNull();
    expect(storagePathFromValue('documents', null)).toBeNull();
  });
});

describe('signedHref', () => {
  test('returns a 1-hour signed link when one can be made', async () => {
    api.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/1' }, error: null });
    await expect(signedHref('documents', `${BASE}/public/documents/documents/1-a.pdf`)).resolves.toBe('https://signed/1');
    expect(api.createSignedUrl).toHaveBeenCalledWith('documents/1-a.pdf', 3600);
  });
  test('Release 1 fallback: keeps the old address if signing fails (no visible change)', async () => {
    const old = `${BASE}/public/compliance-docs/items/1-a.pdf`;
    api.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'not allowed' } });
    await expect(signedHref('compliance-docs', old)).resolves.toBe(old);
  });
  test('external links are returned untouched without calling storage', async () => {
    const ext = 'https://example.org/plan.pdf';
    await expect(signedHref('documents', ext)).resolves.toBe(ext);
    expect(api.createSignedUrl).not.toHaveBeenCalled();
  });
});

describe('removeStoredFile (fixes delete leaving files behind)', () => {
  test('removes the real path parsed from a public address', async () => {
    await removeStoredFile('documents', `${BASE}/public/documents/documents/1700-Fire_Cert.pdf`);
    expect(api.remove).toHaveBeenCalledWith(['documents/1700-Fire_Cert.pdf']);
  });
  test('never touches external links such as the shared council template', async () => {
    const r = await removeStoredFile('documents', 'https://www.waikatodistrict.govt.nz/docs/template.pdf');
    expect(r).toBe(false);
    expect(api.remove).not.toHaveBeenCalled();
  });
});

describe('openStoredFile', () => {
  test('opens the tab immediately, then points it at the signed link', async () => {
    const fakeWin = { location: { href: 'about:blank' }, opener: {}, close: jest.fn() };
    const spy = jest.spyOn(window, 'open').mockReturnValue(fakeWin);
    api.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/2' }, error: null });
    await openStoredFile('finance-receipts', `${BASE}/public/finance-receipts/r/2-b.jpg`);
    expect(spy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(fakeWin.location.href).toBe('https://signed/2');
    expect(fakeWin.opener).toBeNull();
    spy.mockRestore();
  });
});
