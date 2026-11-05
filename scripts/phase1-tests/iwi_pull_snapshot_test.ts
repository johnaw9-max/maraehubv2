// Phase 1, item 3 (P1-03) — iwi-pull-snapshot must never accept a marae key.
// Run from repo root: deno test --no-check --allow-env --allow-read --import-map=scripts/phase1-tests/import_map.json scripts/phase1-tests/iwi_pull_snapshot_test.ts
import { assertEquals, assert } from './assert.ts';

let networkCalls = 0;
globalThis.fetch = (async () => { networkCalls++; return new Response('{}'); }) as typeof fetch;
(globalThis as any).__fakeSupabase = () => { throw new Error('function must not create a database client'); };

await import('../../supabase/functions/iwi-pull-snapshot/index.ts');
const handler = (globalThis as any).__handlers.at(-1);

Deno.test('IW-1 a call carrying a marae administrator key is refused (410) and the key is never used', async () => {
  let bodyRead = false;
  const body = JSON.stringify({ marae_project_url: 'https://x.supabase.co', marae_service_role_key: 'sb_secret_SHOULD_NEVER_BE_USED', marae_project_ref: 'x' });
  const req = new Request('https://iwi.supabase.co/functions/v1/iwi-pull-snapshot', {
    method: 'POST', headers: { 'x-iwi-hub-key': 'whatever', 'content-type': 'application/json' }, body,
  });
  const origJson = req.json.bind(req); (req as any).json = () => { bodyRead = true; return origJson(); };
  const origText = req.text.bind(req); (req as any).text = () => { bodyRead = true; return origText(); };
  const r = await handler(req);
  assertEquals(r.status, 410);
  assert(!bodyRead, 'request body must not be read');
  assertEquals(networkCalls, 0);
  const text = await r.text();
  assert(!text.includes('SHOULD_NEVER_BE_USED'), 'key must not be echoed');
});

Deno.test('IW-2 the source no longer contains the key input or a cross-project client', async () => {
  const src = await Deno.readTextFile(new URL('../../supabase/functions/iwi-pull-snapshot/index.ts', import.meta.url));
  assert(!/req\.json|createClient|marae_service_role_key\s*[},=]/.test(src), 'key input path still present');
});
