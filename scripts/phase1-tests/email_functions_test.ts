// Phase 1, item 1 (P1-01) — tests for send-notification and notify-hirer.
// Run: deno test --allow-env --allow-read --import-map=scripts/phase1-tests/import_map.json scripts/phase1-tests/email_functions_test.ts
// Uses fake keys, a fake database and a fake Resend; sends nothing and touches no project.
import { assertEquals, assert } from './assert.ts';

const SERVICE = 'eyJ.fake-service-role-key-for-tests-only.sig';
const ANON    = 'eyJ.fake-anon-key-for-tests-only.sig';
const CRON    = 'sb_secret_fake_check_deadlines_key_0001';
const OTHER_SECRET = 'sb_secret_fake_other_valid_key_0002';
Deno.env.set('SUPABASE_URL', 'https://testref.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE);
Deno.env.set('CHECK_DEADLINES_SECRET_KEY', CRON);
Deno.env.set('RESEND_API_KEY', 're_fake');

// ── fake database ───────────────────────────────────────────────────────────
type Row = Record<string, any>;
const db: Record<string, Row[]> = {};
let logTableMissing = false;
const sessions: Record<string, string> = {}; // token -> user id
function resetDb() {
  db.profiles = [
    { id: 'u-trustee', email: 'Trustee@Marae.nz', role: 'trustee' },
    { id: 'u-member',  email: 'member@whanau.nz', role: 'community' },
  ];
  db.contacts = [{ email: 'contractor@firm.nz' }];
  db.bookings = [{ contact_email: 'hirer@example.nz' }];
  db.notification_send_log = [];
  logTableMissing = false;
  sessions['tok-trustee'] = 'u-trustee';
  sessions['tok-member'] = 'u-member';
}
function query(table: string) {
  let rows = () => (db[table] ?? []).slice();
  const filters: ((r: Row) => boolean)[] = [];
  const q: any = {
    select() { return q; },
    not(col: string) { filters.push((r) => r[col] != null); return q; },
    eq(col: string, v: any) { filters.push((r) => r[col] === v); return q; },
    gte(col: string, v: any) { filters.push((r) => r[col] >= v); return q; },
    maybeSingle() { return result(true); },
    insert(row: Row) {
      if (table === 'notification_send_log' && logTableMissing) return Promise.resolve({ error: { message: 'missing' } });
      (db[table] ??= []).push({ ...row, created_at: new Date().toISOString() });
      return Promise.resolve({ error: null });
    },
    then(res: any, rej: any) { return result(false).then(res, rej); },
  };
  function result(single: boolean) {
    if (table === 'notification_send_log' && logTableMissing) return Promise.resolve({ data: null, error: { message: 'relation does not exist' } });
    const out = rows().filter((r) => filters.every((f) => f(r)));
    return Promise.resolve({ data: single ? (out[0] ?? null) : out, error: null });
  }
  return q;
}
(globalThis as any).__fakeSupabase = () => ({
  from: query,
  auth: {
    getUser: (tok: string) => Promise.resolve(sessions[tok]
      ? { data: { user: { id: sessions[tok] } }, error: null }
      : { data: { user: null }, error: { message: 'invalid' } }),
  },
});

// ── fake network (Resend + Auth admin probe) ────────────────────────────────
let sent: any[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input);
  if (url.startsWith('https://api.resend.com/')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'email_' + sent.length }), { status: 200 });
  }
  if (url.includes('/auth/v1/admin/users')) {
    const key = init?.headers?.apikey;
    return new Response('{}', { status: key === OTHER_SECRET ? 200 : 401 });
  }
  throw new Error('unexpected fetch ' + url);
}) as typeof fetch;

await import('../../supabase/functions/send-notification/index.ts');
await import('../../supabase/functions/notify-hirer/index.ts');
const [sendNotification, notifyHirer] = (globalThis as any).__handlers;

function req(headers: Record<string, string>, body: unknown, method = 'POST') {
  return new Request('https://testref.supabase.co/functions/v1/x', {
    method, headers: { 'content-type': 'application/json', ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}
const msg = { to: ['admin@maraehub.nz'], subject: 'Daily check', body: 'All good\nline two' };
function fresh() { sent = []; resetDb(); }

// ── send-notification ───────────────────────────────────────────────────────
Deno.test('SN-1 no key is refused and nothing is sent', async () => {
  fresh(); const r = await sendNotification(req({}, msg));
  assertEquals(r.status, 401); assertEquals(sent.length, 0);
});
Deno.test('SN-2 public anon key is refused', async () => {
  fresh(); const r = await sendNotification(req({ authorization: `Bearer ${ANON}`, apikey: ANON }, msg));
  assertEquals(r.status, 401); assertEquals(sent.length, 0);
});
Deno.test('SN-3 stripe-webhook style call (service-role bearer) is accepted, sent as text', async () => {
  fresh(); const r = await sendNotification(req({ authorization: `Bearer ${SERVICE}` }, msg));
  assertEquals(r.status, 200); assertEquals(sent.length, 1);
  assertEquals(sent[0].text, msg.body); assertEquals(sent[0].html, undefined);
});
Deno.test('SN-4 check-deadlines style call (secret key on apikey header) is accepted', async () => {
  fresh(); const r = await sendNotification(req({ apikey: CRON }, msg));
  assertEquals(r.status, 200); assertEquals(sent.length, 1);
});
Deno.test('SN-5 unknown sb_secret_ key is refused after probe', async () => {
  fresh(); const r = await sendNotification(req({ apikey: 'sb_secret_made_up_by_attacker_9999' }, msg));
  assertEquals(r.status, 401); assertEquals(sent.length, 0);
});
Deno.test('SN-6 another genuine project secret key is accepted via probe', async () => {
  fresh(); const r = await sendNotification(req({ apikey: OTHER_SECRET }, msg));
  assertEquals(r.status, 200);
});
Deno.test('SN-7 more than 50 recipients refused', async () => {
  fresh(); const to = Array.from({ length: 51 }, (_, i) => `p${i}@x.nz`);
  const r = await sendNotification(req({ apikey: CRON }, { ...msg, to }));
  assertEquals(r.status, 400); assertEquals(sent.length, 0);
});
Deno.test('SN-8 GET refused', async () => {
  fresh(); const r = await sendNotification(req({ apikey: CRON }, null, 'GET'));
  assertEquals(r.status, 405);
});

// ── notify-hirer ────────────────────────────────────────────────────────────
const toContact = { to: 'contractor@firm.nz', subject: 'Action assigned\r\nBcc: evil', body: 'Kia ora\n<b>not html</b>' };
Deno.test('NH-1 public anon key (old app behaviour / outsider) is refused', async () => {
  fresh(); const r = await notifyHirer(req({ authorization: `Bearer ${ANON}`, apikey: ANON }, toContact));
  assertEquals(r.status, 401); assertEquals(sent.length, 0);
});
Deno.test('NH-2 trustee session can email a known contact; sent as text; subject newline stripped', async () => {
  fresh(); const r = await notifyHirer(req({ authorization: 'Bearer tok-trustee', apikey: ANON }, toContact));
  assertEquals(r.status, 200); assertEquals(sent.length, 1);
  assertEquals(sent[0].html, undefined); assertEquals(sent[0].text, toContact.body);
  assert(!sent[0].subject.includes('\n') && !sent[0].subject.includes('\r'));
  assertEquals(db.notification_send_log.length, 1);
  assertEquals(db.notification_send_log[0].caller, 'trustee');
});
Deno.test('NH-3 trustee can email a booking hirer (invoice / status emails)', async () => {
  fresh(); const r = await notifyHirer(req({ authorization: 'Bearer tok-trustee' }, { ...toContact, to: 'HIRER@example.nz' }));
  assertEquals(r.status, 200);
});
Deno.test('NH-4 trustee cannot email a stranger', async () => {
  fresh(); const r = await notifyHirer(req({ authorization: 'Bearer tok-trustee' }, { ...toContact, to: ['contractor@firm.nz', 'victim@bank.example'] }));
  assertEquals(r.status, 403); assertEquals(sent.length, 0);
});
Deno.test('NH-5 community member can email trustees (booking submitted)', async () => {
  fresh(); const r = await notifyHirer(req({ authorization: 'Bearer tok-member' }, { ...toContact, to: ['trustee@marae.nz'] }));
  assertEquals(r.status, 200); assertEquals(db.notification_send_log[0].caller, 'member');
});
Deno.test('NH-6 community member cannot email contacts or hirers', async () => {
  fresh(); const r = await notifyHirer(req({ authorization: 'Bearer tok-member' }, { ...toContact, to: 'hirer@example.nz' }));
  assertEquals(r.status, 403); assertEquals(sent.length, 0);
});
Deno.test('NH-7 public booking form (server, service-role key) can email trustees', async () => {
  fresh(); const r = await notifyHirer(req({ authorization: `Bearer ${SERVICE}` }, { ...toContact, to: ['trustee@marae.nz'] }));
  assertEquals(r.status, 200); assertEquals(db.notification_send_log[0].caller, 'server');
});
Deno.test('NH-8 hourly limit stops a flood', async () => {
  fresh();
  db.notification_send_log.push({ user_id: 'u-trustee', recipient_count: 59, created_at: new Date().toISOString() });
  const r = await notifyHirer(req({ authorization: 'Bearer tok-trustee' }, { ...toContact, to: ['contractor@firm.nz', 'hirer@example.nz'] }));
  assertEquals(r.status, 429); assertEquals(sent.length, 0);
});
Deno.test('NH-9 old log entries do not count towards the limit', async () => {
  fresh();
  db.notification_send_log.push({ user_id: 'u-trustee', recipient_count: 59, created_at: new Date(Date.now() - 2 * 3600e3).toISOString() });
  const r = await notifyHirer(req({ authorization: 'Bearer tok-trustee' }, { ...toContact, to: ['contractor@firm.nz', 'hirer@example.nz'] }));
  assertEquals(r.status, 200);
});
Deno.test('NH-10 if the log table is not yet created, email still sends (fail open)', async () => {
  fresh(); logTableMissing = true;
  const r = await notifyHirer(req({ authorization: 'Bearer tok-trustee' }, toContact));
  assertEquals(r.status, 200); assertEquals(sent.length, 1);
});
Deno.test('NH-11 no session at all is refused', async () => {
  fresh(); const r = await notifyHirer(req({}, toContact));
  assertEquals(r.status, 401);
});
