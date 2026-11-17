// Test for scripts/copy-marae-data.js on a real Postgres engine (PGlite) behind a fake Supabase API.
// Run: npm install --no-save @electric-sql/pglite && node scripts/tests/copy-marae-data.test.js
// Covers: refusals (same project, protected target, unknown name), dry run writes nothing, the source only
// ever receives selects, exact copy of awkward text, paging, generated/identity columns, rows in wrong
// foreign-key order, numbering continues, --wipe confirmation, tamper detection, column mismatch refusal.
const { PGlite } = require('@electric-sql/pglite');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const SRC = 'aaaaaaaaaaaaaaaaaaaa', DST = 'bbbbbbbbbbbbbbbbbbbb', LIVE = 'cbeenkpjpnhmtqtnjiyd';
const schema = `
create schema if not exists auth; create schema if not exists storage;
create table auth.users (id uuid primary key, email text, encrypted_password text, created_at timestamptz default now(), confirmed_at text generated always as (coalesce(email,'')||'!') stored, raw_user_meta_data jsonb);
create table auth.identities (id uuid primary key, user_id uuid references auth.users(id), provider text, email text generated always as (lower(identity_data->>'email')) stored, identity_data jsonb);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb);
create table public.profiles (id uuid primary key references auth.users(id), role text);
create table public.items (id bigint generated always as identity primary key, note text, tags text[], payload jsonb, blob bytea, at timestamp, price numeric(10,2), parent bigint references public.items(id), len int generated always as (length(note)) stored);
create table public.empty_t (id int primary key);
create table public.seeded (id int primary key, label text);
`;
async function mk() { const db = new PGlite(); await db.exec(schema); return db; }

(async () => {
  const src = await mk(), dst = await mk();
  const nasty = ["it's", 'quo"te', '$$ dollar $q$ tag $mh$', 'back\\slash \\x41', 'ünï©ode 🌿 māori tīpuna', 'new\nline\ttab', '', null];
  await src.exec(`insert into auth.users (id,email,encrypted_password,raw_user_meta_data) values ('00000000-0000-0000-0000-000000000001','a@x.nz','$2a$10$abc','{"k":"v $$"}'),('00000000-0000-0000-0000-000000000002','b@x.nz','h2',null);
    insert into auth.identities (id,user_id,provider,identity_data) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','email','{"email":"A@x.nz"}');
    insert into public.profiles values ('00000000-0000-0000-0000-000000000001','trustee'),('00000000-0000-0000-0000-000000000002','member');
    insert into storage.objects (bucket_id,name,metadata) values ('documents','a/b.pdf','{"size":123}'),('documents','c.pdf','{"size":9}');`);
  // children before parents: parent ids reference rows that come later (id order differs from ctid order)
  await src.exec(`insert into public.items (note,tags,payload,blob,at,price,parent) overriding system value select 'n',null,null,null,null,null,null where false;`);
  await src.exec(`insert into public.items (id,note,tags,payload,blob,at,price,parent) overriding system value values (7,'child',array['a','b c','d"e'],'{"x":[1,2,{"y":"$$"}]}','\\xdeadbeef','2026-11-16 09:32:02.753032',12.50,3),(3,'parent',null,null,null,null,null,null);`);
  for (let i = 0; i < nasty.length; i++) {
    await src.query('insert into public.items (id,note,payload,price) overriding system value values ($1,$2,$3,$4)', [100 + i, nasty[i], JSON.stringify({ n: nasty[i] }), i + 0.25]);
  }
  // big table to force paging (about 3 MB)
  const big = 'x'.repeat(900);
  await src.exec(`insert into public.items (id,note,payload) overriding system value select 1000+g, '${big}'||g, jsonb_build_object('g',g,'s','${big}') from generate_series(1,2500) g;`);
  await src.exec(`select setval(pg_get_serial_sequence('public.items','id'), 5000)`).catch(() => {});
  // target starts with seed rows, as a freshly provisioned project does
  await dst.exec(`insert into public.seeded values (1,'seed row that must be replaced'); insert into public.items (id,note) overriding system value values (1,'stale');`);
  await src.exec(`insert into public.seeded values (2,'real');`);

  const dbs = { [SRC]: src, [DST]: dst };
  const log = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const m = req.url.match(/\/projects\/([a-z]{20})(\/database\/query)?$/);
    const db = m && dbs[m[1]];
    if (!db) { res.statusCode = 404; return res.end(JSON.stringify({ message: 'no project' })); }
    if (!m[2]) return res.end(JSON.stringify({ name: m[1] === DST ? 'maraehub-opeke-syd' : 'maraehub-source' }));
    const query = JSON.parse(body).query;
    log.push({ ref: m[1], query: query.slice(0, 200) });
    try {
      const r = await db.exec(query);
      const last = r[r.length - 1];
      res.end(JSON.stringify(last ? last.rows : []));
    } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ message: e.message })); }
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-'));
  fs.writeFileSync(path.join(tmp, 'token'), 'sbp_test');
  const reg = (extra = []) => { const f = path.join(tmp, 'reg.json'); fs.writeFileSync(f, JSON.stringify({ projects: [{ ref: SRC, name: 'opeke' }, { ref: DST, name: 'opeke-syd' }, { ref: LIVE, name: 'livething' }].concat(extra) })); return f; };
  const run = (args, env = {}) => new Promise((resolve) => { const c = spawn('node', [require('path').join(__dirname, '..', 'copy-marae-data.js'), ...args, '--registry', reg()], { env: { ...process.env, MARAEHUB_MGMT_API: `http://127.0.0.1:${port}/v1`, MARAEHUB_TOKEN_FILE: path.join(tmp, 'token'), ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let so = '', se = ''; c.stdout.on('data', (d) => so += d); c.stderr.on('data', (d) => se += d); c.on('close', (status) => resolve({ status, stdout: so, stderr: se })); });
  const out = (r) => (r.stdout + r.stderr).trim();
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

  let r = await run(['--from', 'opeke', '--to', 'opeke']); ok(r.status !== 0 && /same project/.test(out(r)), 'refuses from==to');
  r = await run(['--from', 'opeke', '--to', 'livething']); ok(r.status !== 0 && /protected live project/.test(out(r)), 'refuses protected target (cbeenk)');
  r = await run(['--from', 'opeke', '--to', 'nope']); ok(r.status !== 0 && /not in the registry/.test(out(r)), 'refuses unknown name');

  const before = JSON.stringify((await src.query('select count(*) from public.items')).rows);
  r = await run(['--from', 'opeke', '--to', 'opeke-syd', '--dry-run']); console.log(out(r).split('\n').slice(0, 8).join('\n'));
  ok(r.status === 0 && /Dry run only/.test(out(r)), 'dry run works');
  ok(JSON.stringify((await dst.query('select count(*) from auth.users')).rows[0]) === '{"count":0}', 'dry run wrote nothing');
  ok(!log.some((l) => l.ref === DST && /^(begin|insert|delete|truncate)/i.test(l.query)), 'dry run sent no write');

  const t = Date.now();
  r = await run(['--from', 'opeke', '--to', 'opeke-syd']); console.log(out(r)); console.log('copy took', Date.now() - t, 'ms');
  ok(r.status === 0 && /Database check passed/.test(out(r)), 'copy + database check passes');
  ok(/Files differ/.test(out(r)), 'files difference is reported (storage rows not copied by this script)');
  ok(!log.some((l) => l.ref === SRC && !/^\s*(select|with)/i.test(l.query)), 'source only ever received selects');
  const seeded = (await dst.query('select * from public.seeded order by id')).rows;
  ok(seeded.length === 1 && seeded[0].label === 'real', 'seed rows replaced by source rows');
  const nasties = (await dst.query('select note from public.items where id between 100 and 107 order by id')).rows.map((x) => x.note);
  ok(JSON.stringify(nasties) === JSON.stringify(nasty), 'nasty text survived exactly (quotes, $$, backslashes, unicode, newline, empty, null)');
  const big2 = (await dst.query('select count(*)::int n from public.items where id>1000')).rows[0].n;
  ok(big2 === 2500, 'big table copied in pages (2500 rows)');
  const pagesSent = log.filter((l) => l.ref === DST && /^begin; set local session_replication_role = replica; insert into "public"."items"/.test(l.query)).length;
  ok(pagesSent > 3, 'paging happened (' + pagesSent + ' inserts for items)');
  const gen = (await dst.query("select email, len from auth.identities i, public.items p where p.id=7")).rows[0];
  ok(gen.email === 'a@x.nz' && gen.len === 5, 'generated columns recomputed, not copied');
  const nx = (await dst.query('insert into public.items (note) values (\'next\') returning id')).rows[0].id;
  ok(Number(nx) === 3501, 'numbering continues after the highest copied id (' + nx + ')');
  ok(JSON.stringify((await dst.query('select parent from public.items where id=7')).rows) === '[{"parent":3}]', 'rows in wrong foreign-key order copied fine');

  r = await run(['--from', 'opeke', '--to', 'opeke-syd']); ok(r.status !== 0 && /--wipe/.test(out(r)), 'second run refuses without --wipe');
  r = await run(['--from', 'opeke', '--to', 'opeke-syd', '--wipe'], { MARAEHUB_TEST_CONFIRM: 'wrong' }); ok(r.status !== 0 && /name did not match|cannot read/.test(out(r)), '--wipe refuses wrong typed name');
  ok((await dst.query('select count(*)::int n from public.items')).rows[0].n > 0, 'refused wipe left data in place');
  await dst.exec(`update public.items set note='tampered' where id=7`);
  r = await run(['--from', 'opeke', '--to', 'opeke-syd', '--verify-only']); ok(r.status !== 0 && /items: source/.test(out(r)), 'verify-only detects tampering (same count, different content)');
  r = await run(['--from', 'opeke', '--to', 'opeke-syd', '--wipe'], { MARAEHUB_TEST_CONFIRM: 'maraehub-opeke-syd' }); ok(r.status === 0 && /Database check passed/.test(out(r)), '--wipe with right name recopies and passes');
  await dst.exec(`insert into storage.objects (bucket_id,name,metadata) values ('documents','a/b.pdf','{"size":123}'),('documents','c.pdf','{"size":9}')`);
  r = await run(['--from', 'opeke', '--to', 'opeke-syd', '--verify-only']); ok(r.status === 0 && /Files match: 2 files/.test(out(r)), 'verify-only passes and sees matching files');
  // schema mismatch refusal
  await dst.exec('alter table public.seeded add column extra text');
  r = await run(['--from', 'opeke', '--to', 'opeke-syd', '--wipe'], { MARAEHUB_TEST_CONFIRM: 'maraehub-opeke-syd' }); ok(r.status !== 0 && /exist in the target but not the source/.test(out(r)), 'refuses when columns differ');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASSED');
  server.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
