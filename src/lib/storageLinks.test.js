import { storagePathFromRef, openStorageFile } from './storageLinks';

test('path only is used as is', () => {
  expect(storagePathFromRef('documents', 'documents/1-a.pdf')).toEqual({ kind: 'path', path: 'documents/1-a.pdf' });
});
test('old public storage url becomes bucket + path', () => {
  const u = 'https://x.supabase.co/storage/v1/object/public/documents/documents/1790-Cleaning%20Report..pdf';
  expect(storagePathFromRef('documents', u)).toEqual({ kind: 'path', bucket: 'documents', path: 'documents/1790-Cleaning Report..pdf' });
});
test('a link to another website is left alone', () => {
  const u = 'https://www.civildefence.govt.nz/docs/plan.pdf';
  expect(storagePathFromRef('documents', u)).toEqual({ kind: 'external', url: u });
});
test('opens with a fresh signed link, or reports a friendly failure', async () => {
  const opened = [];
  const ok = { storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://s/signed' }, error: null }) }) } };
  expect(await openStorageFile(ok, 'documents', 'documents/a.pdf', u => opened.push(u))).toEqual({ ok: true });
  expect(opened).toEqual(['https://s/signed']);
  const bad = { storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'x' } }) }) } };
  const r = await openStorageFile(bad, 'documents', 'documents/a.pdf', () => {});
  expect(r.ok).toBe(false);
  expect(r.message).toMatch(/Could not open/);
});
