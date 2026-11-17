#!/usr/bin/env node
// Copies ONE marae's data from one Supabase project to another (database rows and
// sign-in users). Built for the Opeke move from Seoul to Sydney (ClickUp 14yhc7kw7b2),
// reusable for any "same marae, new project" move.
//
//   node scripts/copy-marae-data.js --from opeke --to opeke-syd --dry-run     counts only, writes nothing
//   node scripts/copy-marae-data.js --from opeke --to opeke-syd               copy, then check
//   node scripts/copy-marae-data.js --from opeke --to opeke-syd --wipe        copy again over an earlier copy
//   node scripts/copy-marae-data.js --from opeke --to opeke-syd --verify-only check only
//
// Names are the names in scripts/marae-registry.json. Files in storage buckets are copied by
// scripts/copy-marae-files.sh (they are not rows); --verify-only also checks them.
//
// Safety rules (no override flags):
//   - the SOURCE is only ever read: every query sent to it must be a plain select
//   - the TARGET may not be a protected live project (cbeenk Opeke, fwtxb Terere, zfefu test,
//     autzr Iwi Hub) and must be a project named maraehub-*
//   - the target must have the same tables and columns as the source (refuses otherwise)
//   - a target that already holds sign-in users is only overwritten with --wipe plus typing its name
//   - data values are never printed: only table names and counts
//   - restoring does not run triggers and does not check foreign keys (the whole set is consistent)
//   - safe to run twice: each run first empties the target's data, then copies, then checks
//
// Needs Node 18+ and the token from `supabase login` (~/.supabase/access-token).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(n);
const FROM = arg('--from');
const TO = arg('--to');
const MODE = has('--verify-only') ? 'verify' : has('--dry-run') ? 'dry' : 'copy';
const WIPE = has('--wipe');
const DEFAULT_API = 'https://api.supabase.com/v1';
const API = process.env.MARAEHUB_MGMT_API || DEFAULT_API;
const TOKEN_FILE = process.env.MARAEHUB_TOKEN_FILE || path.join(os.homedir(), '.supabase', 'access-token');
const REGISTRY = arg('--registry') || path.join(__dirname, 'marae-registry.json');
const PROTECTED = ['cbeenk', 'fwtxb', 'zfefu', 'autzr'];
const PAGE_BYTES = 400 * 1024;

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }
const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';

if (!FROM || !TO) fail('Usage: node scripts/copy-marae-data.js --from <name> --to <name> [--dry-run | --verify-only] [--wipe]');
if (FROM === TO) fail('--from and --to are the same project. Refusing.');
if (typeof fetch !== 'function') fail('Node 18 or newer is needed (for fetch).');
if (!fs.existsSync(TOKEN_FILE)) fail(TOKEN_FILE + ' not found: run "supabase login" first');
const TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).projects;
const entry = (n) => registry.find((p) => p.name === n) || fail("'" + n + "' is not in the registry (" + REGISTRY + ')');
const SRC = entry(FROM).ref;
const DST = entry(TO).ref;
if (!/^[a-z]{20}$/.test(SRC) || !/^[a-z]{20}$/.test(DST)) fail('registry refs do not look like project refs');
if (PROTECTED.some((p) => DST.startsWith(p))) fail(DST + ' is a protected live project (Opeke, Terere, test or Iwi Hub). It can never be a target. No override exists.');

const SOURCE_FORBIDDEN = /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|call|do|set|begin|commit)\b/i;

async function sql(ref, query) {
  if (ref === SRC) {
    if (!/^\s*(select|with)\b/i.test(query) || SOURCE_FORBIDDEN.test(query)) {
      throw new Error('internal safety stop: only plain select queries may be sent to the source project');
    }
  }
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API + '/projects/' + ref + '/database/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch (e) { throw new Error('unreadable reply (HTTP ' + res.status + ')'); }
      if (!res.ok || (body && !Array.isArray(body) && body.message)) {
        const m = String((body && body.message) || res.status).slice(0, 300);
        const err = new Error('SQL error on ' + ref.slice(0, 5) + '…: ' + m);
        err.permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
        throw err;
      }
      return body;
    } catch (e) {
      lastErr = e;
      if (e.permanent) break;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

async function projectName(ref) {
  const res = await fetch(API + '/projects/' + ref, { headers: { Authorization: 'Bearer ' + TOKEN } });
  const b = await res.json().catch(() => ({}));
  return b.name || '';
}

async function describe(ref) {
  const tables = await sql(ref, "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1");
  const cols = await sql(ref, "select table_schema, table_name, column_name, is_generated from information_schema.columns where (table_schema='public' or (table_schema='auth' and table_name in ('users','identities'))) order by table_schema, table_name, ordinal_position");
  const byTable = {};
  for (const c of cols) {
    const k = c.table_schema + '.' + c.table_name;
    (byTable[k] = byTable[k] || []).push({ name: c.column_name, generated: c.is_generated === 'ALWAYS' });
  }
  return { tables: tables.map((t) => 'public.' + t.table_name), byTable };
}

function confirmTyped(expected) {
  if (API !== DEFAULT_API && process.env.MARAEHUB_TEST_CONFIRM === expected) return true; // tests only: never the real API
  let ans = '';
  try {
    const fd = fs.openSync('/dev/tty', 'r');
    process.stdout.write('Type the target project name to confirm: ');
    const buf = Buffer.alloc(256);
    const n = fs.readSync(fd, buf, 0, 256, null);
    ans = buf.slice(0, n).toString().trim();
    fs.closeSync(fd);
  } catch (e) { fail('cannot read a typed answer (no terminal). Nothing changed.'); }
  return ans === expected;
}

async function main() {
  const t0 = Date.now();
  const dstName = await projectName(DST);
  if (!/^maraehub-/.test(dstName)) fail("target '" + dstName + "' is not named maraehub-*. Refusing.");
  console.log('From: ' + FROM + ' (' + SRC.slice(0, 5) + '…)   To: ' + TO + ' (' + DST.slice(0, 5) + '…, ' + dstName + ')   Mode: ' + MODE + (WIPE ? ' +wipe' : ''));

  // ── 1 plan: same tables, same columns ──
  const [s, d] = [await describe(SRC), await describe(DST)];
  const missingT = s.tables.filter((t) => !d.tables.includes(t));
  const extraT = d.tables.filter((t) => !s.tables.includes(t));
  if (missingT.length || extraT.length) fail('tables differ. Only in source: [' + missingT.join(', ') + '] only in target: [' + extraT.join(', ') + ']. Bring the target up to date first. Nothing changed.');
  const plan = [];
  for (const key of ['auth.users', 'auth.identities'].concat(s.tables)) {
    const sc = s.byTable[key]; const dc = d.byTable[key];
    if (!sc || !dc) fail(key + ' is missing on one side. Nothing changed.');
    const dstUsable = dc.filter((c) => !c.generated).map((c) => c.name);
    const srcUsable = sc.filter((c) => !c.generated).map((c) => c.name);
    const lost = srcUsable.filter((c) => !dstUsable.includes(c));
    const absent = dstUsable.filter((c) => !srcUsable.includes(c));
    if (lost.length) fail(key + ': column(s) ' + lost.join(', ') + ' exist in the source but not the target (data would be lost). Nothing changed.');
    if (absent.length) fail(key + ': column(s) ' + absent.join(', ') + ' exist in the target but not the source. Nothing changed.');
    const [schema, table] = key.split('.');
    plan.push({ key, schema, table, cols: dstUsable });
  }
  const qt = (p) => q(p.schema) + '.' + q(p.table);
  const colList = (p) => p.cols.map(q).join(', ');

  // ── 2 counts ──
  const counts = {};
  for (const p of plan) {
    const a = await sql(SRC, 'select count(*)::int as n from ' + qt(p));
    const b = await sql(DST, 'select count(*)::int as n from ' + qt(p));
    counts[p.key] = { src: a[0].n, dst: b[0].n };
  }
  const srcRows = plan.reduce((n, p) => n + counts[p.key].src, 0);
  const dstUsers = counts['auth.users'].dst;
  console.log('Source holds ' + srcRows + ' rows in ' + plan.filter((p) => counts[p.key].src > 0).length + ' of ' + plan.length + ' tables (' + counts['auth.users'].src + ' sign-in users).');

  if (MODE === 'dry') {
    for (const p of plan) if (counts[p.key].src || counts[p.key].dst) console.log('  ' + p.key.padEnd(40) + ' source ' + String(counts[p.key].src).padStart(6) + '   target ' + String(counts[p.key].dst).padStart(6));
    console.log('Dry run only: nothing was written.' + (dstUsers > 0 ? ' The target already holds ' + dstUsers + ' users, so a real run needs --wipe.' : ''));
    return;
  }

  if (MODE === 'copy') {
    if (dstUsers > 0 && !WIPE) fail('the target already holds ' + dstUsers + ' sign-in users (an earlier copy or real use). To overwrite it run again with --wipe. Nothing changed.');
    if (dstUsers > 0 && WIPE) {
      console.log('The target project "' + dstName + '" already holds data. --wipe will replace ALL of it with a fresh copy of ' + FROM + '.');
      if (!confirmTyped(dstName)) fail('name did not match; nothing changed');
    }

    // ── 3 empty the target's data (not its structure) ──
    console.log('Emptying the target\'s data tables…');
    await sql(DST, 'begin; set local session_replication_role = replica; delete from auth.identities; delete from auth.users; truncate table ' + s.tables.map((t) => q('public') + '.' + q(t.slice(7))).join(', ') + '; commit;');

    // ── 4 copy table by table ──
    let copied = 0;
    for (const p of plan) {
      const n = counts[p.key].src;
      if (!n) continue;
      const sizeRow = await sql(SRC, 'select coalesce(sum(pg_column_size(t)),0)::bigint as b from ' + qt(p) + ' t');
      const bytes = Number(sizeRow[0].b);
      const pages = Math.max(1, Math.ceil(bytes / PAGE_BYTES));
      const per = Math.ceil(n / pages);
      for (let off = 0; off < n; off += per) {
        const r = await sql(SRC, 'select coalesce(jsonb_agg(to_jsonb(x)), \'[]\'::jsonb)::text as j from (select ' + colList(p) + ' from ' + qt(p) + ' order by ctid limit ' + per + ' offset ' + off + ') x');
        const json = r[0].j;
        let tag; do { tag = '$mh' + crypto.randomBytes(6).toString('hex') + '$'; } while (json.includes(tag));
        await sql(DST, 'begin; set local session_replication_role = replica; insert into ' + qt(p) + ' (' + colList(p) + ') overriding system value select ' + colList(p) + ' from jsonb_populate_recordset(null::' + qt(p) + ', ' + tag + json + tag + '::jsonb); commit;');
      }
      copied += n;
      console.log('  copied ' + p.key.padEnd(40) + String(n).padStart(6) + ' rows');
    }

    // ── 5 keep numbering going from the right place ──
    for (const p of plan) {
      const seqCols = await sql(DST, "select column_name from information_schema.columns where table_schema=" + "'" + p.schema + "'" + " and table_name='" + p.table + "' and (is_identity='YES' or column_default like 'nextval(%')");
      for (const c of seqCols) {
        await sql(DST, 'select setval(pg_get_serial_sequence(\'' + q(p.schema) + '.' + q(p.table) + '\', \'' + c.column_name + '\'), coalesce(max(' + q(c.column_name) + '), 1), max(' + q(c.column_name) + ') is not null) from ' + qt(p) + ' having pg_get_serial_sequence(\'' + q(p.schema) + '.' + q(p.table) + '\', \'' + c.column_name + '\') is not null');
      }
    }
    console.log('Copied ' + copied + ' rows.');
  }

  // ── 6 check: same count and same content, table by table ──
  let bad = 0;
  for (const p of plan) {
    const sum = 'select count(*)::int as n, coalesce(md5(string_agg(h, \',\' order by h)), \'\') as c from (select md5(to_jsonb(x)::text) as h from (select ' + colList(p) + ' from ' + qt(p) + ') x) s';
    const [a, b] = [(await sql(SRC, sum))[0], (await sql(DST, sum))[0]];
    if (a.n !== b.n || a.c !== b.c) { bad++; console.log('  ❌ ' + p.key + ': source ' + a.n + ' rows, target ' + b.n + ' rows' + (a.n === b.n ? ' (same count, different content)' : '')); }
  }
  const files = 'select coalesce(string_agg(bucket_id || \'/\' || name || \':\' || coalesce(metadata->>\'size\', \'\'), \',\' order by bucket_id, name), \'\') as f, count(*)::int as n from storage.objects';
  const [fa, fb] = [(await sql(SRC, files))[0], (await sql(DST, files))[0]];
  const filesOk = fa.f === fb.f;
  console.log(bad === 0 ? '✅ Database check passed: ' + plan.length + ' tables match in count and content.' : '❌ Database check FAILED for ' + bad + ' table(s).');
  console.log(filesOk ? '✅ Files match: ' + fa.n + ' files, same names and sizes.' : '⚠️  Files differ: source ' + fa.n + ' files, target ' + fb.n + '. Run scripts/copy-marae-files.sh ' + FROM + ' ' + TO + ', then --verify-only.');
  console.log('Took ' + Math.round((Date.now() - t0) / 1000) + 's. No data values were printed.');
  if (bad) process.exit(1);
}

main().catch((e) => fail(e.message));
