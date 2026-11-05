// Phase 1, item 9 (P1-09) — draft-minutes consent and admin switch.
// Run from repo root: deno test --no-check --allow-env --allow-read --import-map=scripts/phase1-tests/import_map.json scripts/phase1-tests/draft_minutes_test.ts
import { assertEquals } from './assert.ts';

Deno.env.set('SUPABASE_URL', 'https://testref.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY', 'anon');
Deno.env.set('ANTHROPIC_API_KEY', 'fake');

let role = 'trustee';
let setting: { ai_drafting_enabled?: boolean } | null = { ai_drafting_enabled: true };
let settingError: unknown = null;
(globalThis as any).__fakeSupabase = () => ({
  auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
  from: (table: string) => {
    const q: any = {
      select: () => q, eq: () => q, limit: () => q,
      single: () => Promise.resolve({ data: { role }, error: null }),
      maybeSingle: () => Promise.resolve(table === 'marae_settings' ? { data: setting, error: settingError } : { data: null, error: null }),
    };
    return q;
  },
});

await import('../../supabase/functions/draft-minutes/index.ts');
const handler = (globalThis as any).__handlers.at(-1);
const calls = () => ((globalThis as any).__aiCalls ?? []).length;
const req = (body: unknown) => new Request('https://testref.supabase.co/functions/v1/draft-minutes', {
  method: 'POST', headers: { authorization: 'Bearer tok', 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const notes = { maraeName: 'Test Marae', roughNotes: 'Agreed to get 2 quotes for the roof.' };

Deno.test('AI-1 without the tick box confirmation, nothing is sent to the AI service', async () => {
  const before = calls(); const r = await handler(req(notes));
  assertEquals(r.status, 400); assertEquals(calls(), before);
});
Deno.test('AI-2 with confirmation and AI enabled, a draft is produced', async () => {
  setting = { ai_drafting_enabled: true }; const before = calls();
  const r = await handler(req({ ...notes, aiConsent: true }));
  assertEquals(r.status, 200); assertEquals(calls(), before + 1);
});
Deno.test('AI-3 admin switched AI off: refused even with confirmation, nothing sent', async () => {
  setting = { ai_drafting_enabled: false }; const before = calls();
  const r = await handler(req({ ...notes, aiConsent: true }));
  assertEquals(r.status, 403); assertEquals(calls(), before);
});
Deno.test('AI-4 opt-in: setting column not yet added → refused, nothing sent', async () => {
  setting = null; settingError = { message: 'column does not exist' }; const before = calls();
  const r = await handler(req({ ...notes, aiConsent: true }));
  assertEquals(r.status, 403); assertEquals(calls(), before);
  settingError = null; setting = { ai_drafting_enabled: true };
});
Deno.test('AI-6 opt-in: no settings row / value not set → refused, nothing sent', async () => {
  setting = null; const before = calls();
  const r = await handler(req({ ...notes, aiConsent: true }));
  assertEquals(r.status, 403); assertEquals(calls(), before);
  setting = { ai_drafting_enabled: true };
});
Deno.test('AI-5 community members still refused (unchanged)', async () => {
  role = 'community'; const before = calls();
  const r = await handler(req({ ...notes, aiConsent: true }));
  assertEquals(r.status, 403); assertEquals(calls(), before); role = 'trustee';
});
