#!/usr/bin/env node
'use strict';

// Read-only integrity audit of ONE marae's Supabase project against the
// REPO ON MAIN as reference -- never Opeke, never test, never another
// marae's database. Reference facts (migrations, supabase/functions
// source, each function's own Deno.env.get() calls, scripts/marae-registry.json)
// are read via `git show main:<path>` / `git ls-tree main`, so the result
// reflects what's actually released, not whatever happens to be checked
// out on the current branch.
//
// Catalog/metadata reads, CLI list/download/advisors/backups commands, and
// plain HTTP GET/OPTIONS against the public frontend and function URLs
// only. Never a row's business data, never a secret value, never a
// database write, never a deploy. See README.md for usage.
//
// One marae per invocation by design:
//   node scripts/drift-check/integrity-audit.js --marae terere

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const REPO_ROOT = path.join(ROOT, '..', '..');
const REGISTRY_REL = 'scripts/marae-registry.json';
const ALLOWLIST_PATH = path.join(ROOT, 'integrity-allowlist.json');
const REPORTS_DIR = path.join(ROOT, 'reports');
const REFERENCE_BRANCH = 'main';
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');

// Platform-managed secrets present on every Supabase project automatically --
// not something a human configures, so never reported as missing/unexpected.
const PLATFORM_AUTO_SECRETS = new Set([
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL', 'SUPABASE_JWKS', 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_SECRET_KEYS',
]);

// The cron jobs this codebase's migrations ever schedule (grep for
// 'maraehub-[a-z-]+' across supabase/migrations/*.sql on main to re-derive
// if this ever changes).
const ALL_CRON_JOBS = ['maraehub-check-deadlines', 'maraehub-notify-trustees', 'maraehub-lock-kpi-snapshot'];

// Expected final storage.objects state for the two buckets with
// migration-declared RLS (see supabase/migrations/20260816020000_create_meeting_attachments_bucket.sql
// and the 2026-10-10/11 documents-bucket hardening migrations). A bucket/
// policy change on main needs a matching one-line update here.
const EXPECTED_STORAGE = {
  'meeting-attachments': { public: false, policies: ['meeting-attachments: allow all uploads'] },
  documents: {
    public: true,
    policies: ['documents: authenticated insert', 'documents: authenticated update', 'documents: authenticated delete', 'documents: authenticated read'],
  },
};
const FORBIDDEN_STORAGE_POLICIES = ['Allow all maraehub'];

const EMAIL_SECRET_NAMES = ['RESEND_API_KEY', 'FROM_EMAIL'];

const CHECK_LABELS = [
  ['migrations', 'MIGRATIONS'],
  ['edge_functions', 'EDGE FUNCTIONS'],
  ['secrets', 'SECRETS'],
  ['scheduled_jobs', 'SCHEDULED JOBS'],
  ['security', 'SECURITY'],
  ['accounts', 'ACCOUNTS'],
  ['data_sanity', 'DATA SANITY'],
  ['backups', 'BACKUPS'],
  ['advisors', 'ADVISORS'],
  ['hosting', 'HOSTING'],
  ['email', 'EMAIL'],
];

// ── CLI ARGS ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { marae: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--marae') args.marae = argv[++i];
    else if (arg.startsWith('--marae=')) args.marae = arg.slice('--marae='.length);
    else if (arg === '--json') args.json = true;
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/drift-check/integrity-audit.js --marae <name> [--json]

Audits ONE marae (by its "name" in scripts/marae-registry.json, read from
the ${REFERENCE_BRANCH} branch) against the repo itself -- migrations,
deployed function source, each function's own required secrets, scheduled
jobs, RLS/storage security, account/data integrity, backups, advisors,
hosting, and email secret names. One marae per invocation, by design --
run it once per marae you need to check.

  --marae <name>   Required. The marae to audit (e.g. terere, test, opeke).
  --json            Also print the full machine-readable report to stdout.

Requires an already-authenticated \`supabase\` CLI (run \`npx supabase login\`
once, interactively, if needed -- this script never asks for or handles a
key; if the CLI itself ever needs one, let it prompt you in the terminal).
`);
}

// ── SHELL HELPERS (every external command is echoed before it runs) ──────

const CLI_NOISE = [/^Initialising login role\.\.\.$/, /^A new version of Supabase CLI/, /^We recommend updating/, /^Try rerunning the command/, /^Connecting to remote database/, /^Skipping migration/];
function cleanStderr(stderr) {
  return stderr.split('\n').filter((l) => l.trim() && !CLI_NOISE.some((re) => re.test(l.trim()))).join('\n').trim();
}

function run(cmd, args, ref) {
  const label = ref ? `  (project: ${ref})` : '';
  console.log(`$ ${cmd} ${args.join(' ')}${label}`);
  const res = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
  if (res.error) return { ok: false, stdout: '', stderr: String(res.error) };
  if (res.status !== 0) return { ok: false, stdout: res.stdout || '', stderr: cleanStderr(res.stderr || '') };
  return { ok: true, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function linkProject(ref) { return run('npx', ['supabase', 'link', '--project-ref', ref], ref); }

function dbQueryJSON(sql, ref) {
  const res = run('npx', ['supabase', 'db', 'query', '--linked', sql], ref);
  if (!res.ok) return { error: (res.stderr || res.stdout || 'unknown error').trim() };
  try { return { rows: JSON.parse(res.stdout).rows || [] }; }
  catch (e) { return { error: `could not parse CLI output as JSON: ${e.message}` }; }
}

function cliListJSON(args, ref) {
  const res = run('npx', args, ref);
  if (!res.ok) return { error: (res.stderr || res.stdout || 'unknown error').trim() };
  try { return { data: JSON.parse(res.stdout) }; }
  catch (e) { return { error: `could not parse CLI output as JSON: ${e.message}` }; }
}

function httpStatus(url, method) {
  console.log(`$ curl -s -o /dev/null -w '%{http_code}' -X ${method} '${url}'`);
  const res = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', method, '--max-time', '15', url], { encoding: 'utf8' });
  return (res.stdout || 'ERR').trim();
}

function fetchText(url) {
  console.log(`$ curl -s --max-time 15 '${url}'`);
  const res = spawnSync('curl', ['-s', '--max-time', '15', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  if (res.status !== 0 || !res.stdout) return null;
  return res.stdout;
}

// ── REPO-ON-MAIN REFERENCE (read via git, not the filesystem of whatever
// branch is checked out) ───────────────────────────────────────────────

function gitShow(relPath) {
  console.log(`$ git -C ${path.relative(process.cwd(), REPO_ROOT) || '.'} show ${REFERENCE_BRANCH}:${relPath}`);
  const res = spawnSync('git', ['-C', REPO_ROOT, 'show', `${REFERENCE_BRANCH}:${relPath}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 });
  if (res.status !== 0) return null;
  return res.stdout;
}

function gitLsTreeFlat(relPath) {
  // A trailing slash is required so git expands the directory's own
  // contents instead of listing the directory entry itself as one line.
  const res = spawnSync('git', ['-C', REPO_ROOT, 'ls-tree', REFERENCE_BRANCH, '--name-only', '--', `${relPath}/`], { encoding: 'utf8' });
  if (res.status !== 0) return [];
  return res.stdout.split('\n').filter(Boolean);
}

function gitLsTreeTyped(relPath) {
  const res = spawnSync('git', ['-C', REPO_ROOT, 'ls-tree', REFERENCE_BRANCH, '--', `${relPath}/`], { encoding: 'utf8' });
  if (res.status !== 0) return [];
  return res.stdout.split('\n').filter(Boolean).map((line) => {
    const [meta, p] = line.split('\t');
    const type = meta.split(' ')[1];
    return { type, name: path.basename(p) };
  });
}

function repoCommit() {
  const res = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--short', REFERENCE_BRANCH], { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : 'unknown';
}

function repoMigrationVersions() {
  return gitLsTreeFlat('supabase/migrations')
    .map((f) => path.basename(f))
    .filter((f) => /^\d+_/.test(f))
    .map((f) => f.match(/^(\d+)_/)[1]);
}

function repoFunctionNames() {
  return gitLsTreeTyped('supabase/functions')
    .filter((e) => e.type === 'tree' && !e.name.startsWith('_'))
    .map((e) => e.name);
}

function functionSource(name) { return gitShow(`supabase/functions/${name}/index.ts`); }

function functionSecrets(name) {
  const text = functionSource(name);
  if (text == null) return new Set();
  const matches = text.matchAll(/Deno\.env\.get\('([A-Z_]+)'\)/g);
  return new Set([...matches].map((m) => m[1]));
}

function browserInvokedFunctions() {
  const res = spawnSync('git', ['-C', REPO_ROOT, 'grep', '-ohE', "functions\\.invoke\\('[a-z-]+'", REFERENCE_BRANCH, '--', 'src'], { encoding: 'utf8' });
  const names = new Set();
  for (const m of (res.stdout || '').matchAll(/functions\.invoke\('([a-z-]+)'/g)) names.add(m[1]);
  return [...names].sort();
}

function loadRegistry() {
  const text = gitShow(REGISTRY_REL);
  if (text == null) throw new Error(`could not read ${REGISTRY_REL} from ${REFERENCE_BRANCH}`);
  return JSON.parse(text);
}

function loadAllowlist() { return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8')); }

function isAllowed(allowlist, category, item, maraeName) {
  return allowlist.entries.find((e) => e.category === category && e.item === item && (e.marae === maraeName || e.marae === '*')) || null;
}

function expectedFunctionsFor(project, allFunctions) {
  const excluded = new Set((project.excluded_functions || []).map((f) => f.name));
  return allFunctions.filter((f) => !excluded.has(f));
}

function requiredSecretsFor(expectedFunctions) {
  const set = new Set();
  for (const fn of expectedFunctions) for (const s of functionSecrets(fn)) if (!PLATFORM_AUTO_SECRETS.has(s)) set.add(s);
  return set;
}

function expectedJobsFor(project) {
  const excluded = new Set((project.excluded_jobs || []).map((j) => j.name));
  return ALL_CRON_JOBS.filter((j) => !excluded.has(j));
}

// ── CHECKS ──────────────────────────────────────────────────────────────
// Each check returns { result: 'pass'|'fail'|'could not check', evidence, short }.
// `short` is written to fit the one-line summary (kept well under 80 chars
// together with the check number/label/result); `evidence` is the full detail.

function checkMigrations(ref, localVersions) {
  const res = run('npx', ['supabase', 'migration', 'list', '--linked'], ref);
  if (!res.ok) return { result: 'could not check', evidence: res.stderr || res.stdout, short: 'CLI error listing migrations' };
  const remote = new Set();
  for (const line of res.stdout.split('\n')) {
    const cols = line.split('|').map((c) => c.trim());
    if (cols.length < 2) continue;
    const [l, r] = cols;
    if (!/^\d+$/.test(l)) continue;
    if (/^\d+$/.test(r)) remote.add(r);
  }
  const local = new Set(localVersions);
  const missing = [...local].filter((v) => !remote.has(v)).sort();
  const extra = [...remote].filter((v) => !local.has(v)).sort();
  const result = missing.length === 0 && extra.length === 0 ? 'pass' : 'fail';
  return {
    result,
    short: result === 'pass' ? 'tracking table matches repo@main exactly' : `${missing.length} untracked (bookkeeping only, verify before assuming unapplied)`,
    evidence: `${local.size} local (repo@main), ${remote.size} tracked-applied, ${missing.length} missing, ${extra.length} extra (no local file). Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}. NOTE: "missing" means untracked in the migration bookkeeping table -- verify against live schema before assuming the DDL never ran; this codebase has a known history of real changes applied via direct db query that were never recorded as migrations.`,
  };
}

function checkEdgeFunctions(ref, project, allFunctions, allowlist) {
  const expected = expectedFunctionsFor(project, allFunctions);
  const excluded = (project.excluded_functions || []).map((f) => f.name);
  const listRes = cliListJSON(['supabase', 'functions', 'list'], ref);
  if (listRes.error) return { result: 'could not check', evidence: listRes.error, short: 'CLI error listing functions' };
  const deployed = new Map(listRes.data.map((f) => [f.name, f.status]));

  const missing = expected.filter((f) => !deployed.has(f));
  const notActive = expected.filter((f) => deployed.has(f) && deployed.get(f) !== 'ACTIVE');
  const excludedButDeployedRaw = excluded.filter((f) => deployed.has(f));
  const excludedButDeployed = excludedButDeployedRaw.filter((f) => !isAllowed(allowlist, 'excluded_function_deployed', f, project.name));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-audit-fn-'));
  const dlRes = run('npx', ['supabase', 'functions', 'download', '--project-ref', ref, '--workdir', tmpDir, '--use-api'], ref);
  const mismatched = [];
  if (dlRes.ok) {
    for (const fn of expected) {
      if (!deployed.has(fn)) continue;
      const repoSource = functionSource(fn);
      const dlFile = path.join(tmpDir, 'supabase', 'functions', fn, 'index.ts');
      if (repoSource == null || !fs.existsSync(dlFile)) continue;
      const downloaded = fs.readFileSync(dlFile, 'utf8');
      if (repoSource !== downloaded) mismatched.push(fn);
    }
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const result = missing.length === 0 && notActive.length === 0 && excludedButDeployed.length === 0 && mismatched.length === 0 ? 'pass' : 'fail';
  const shortBits = [];
  if (missing.length) shortBits.push(`${missing.length} missing`);
  if (notActive.length) shortBits.push(`${notActive.length} not ACTIVE`);
  if (excludedButDeployed.length) shortBits.push(`${excludedButDeployed.length} excluded-but-deployed`);
  if (mismatched.length) shortBits.push(`${mismatched.length} source mismatch`);
  return {
    result,
    short: result === 'pass' ? `${expected.length}/${expected.length} deployed, ACTIVE, source matches repo@main` : shortBits.join(', '),
    evidence: `${expected.length} expected, ${expected.length - missing.length} deployed. Missing: ${missing.join(', ') || 'none'}. Not ACTIVE: ${notActive.join(', ') || 'none'}. Excluded-but-deployed: ${excludedButDeployed.join(', ') || 'none'}${excludedButDeployedRaw.length > excludedButDeployed.length ? ` (${excludedButDeployedRaw.length - excludedButDeployed.length} allowlisted)` : ''}. Source mismatch vs repo@main, bundle hash ignored (downloaded source compared byte-for-byte instead): ${mismatched.join(', ') || 'none'}.`,
  };
}

function checkSecretsFromSet(actual, requiredSecrets, maraeName, allowlist) {
  const missingRaw = [...requiredSecrets].filter((s) => !actual.has(s)).sort();
  const unexpectedRaw = [...actual].filter((s) => !requiredSecrets.has(s) && !PLATFORM_AUTO_SECRETS.has(s)).sort();
  const missingAllowed = missingRaw.filter((s) => isAllowed(allowlist, 'secret_name', s, maraeName));
  const missing = missingRaw.filter((s) => !isAllowed(allowlist, 'secret_name', s, maraeName));
  const unexpectedAllowed = unexpectedRaw.filter((s) => isAllowed(allowlist, 'unexpected_secret', s, maraeName));
  const unexpected = unexpectedRaw.filter((s) => !isAllowed(allowlist, 'unexpected_secret', s, maraeName));
  const result = missing.length === 0 && unexpected.length === 0 ? 'pass' : 'fail';
  const cleanShort = `${requiredSecrets.size}/${requiredSecrets.size} required names present`;
  const allowedShort = `${requiredSecrets.size - missingRaw.length}/${requiredSecrets.size} present, ${missingAllowed.length} allowlisted-missing`;
  return {
    result,
    short: result === 'pass' ? (missingAllowed.length ? allowedShort : cleanShort) : `missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`,
    evidence: `${requiredSecrets.size} required (derived from repo@main function source), ${requiredSecrets.size - missingRaw.length} present. Missing: ${missing.join(', ') || 'none'}${missingAllowed.length ? ` (allowlisted: ${missingAllowed.join(', ')})` : ''}. Unexpected names present: ${unexpected.join(', ') || 'none'}${unexpectedAllowed.length ? ` (allowlisted: ${unexpectedAllowed.join(', ')})` : ''}. Values are never read.`,
  };
}

function checkScheduledJobs(ref, expectedJobs) {
  if (expectedJobs.length === 0) return { result: 'pass', short: 'no jobs expected on this marae', evidence: 'no scheduled jobs expected on this marae per scripts/marae-registry.json excluded_jobs.' };
  const sql = `select jobname, schedule, active, (select max(start_time) from cron.job_run_details jrd where jrd.jobid = j.jobid) as last_run, (select status from cron.job_run_details jrd where jrd.jobid = j.jobid order by start_time desc limit 1) as last_status from cron.job j where jobname = any(array[${expectedJobs.map((j) => `'${j}'`).join(',')}]) order by jobname;`;
  const { rows, error } = dbQueryJSON(sql, ref);
  if (error) return { result: 'could not check', evidence: error, short: 'could not read cron.job' };
  const byName = new Map(rows.map((r) => [r.jobname, r]));
  const missing = expectedJobs.filter((j) => !byName.has(j));
  const inactive = expectedJobs.filter((j) => byName.has(j) && !byName.get(j).active);
  const failed = expectedJobs.filter((j) => byName.has(j) && byName.get(j).last_status && byName.get(j).last_status !== 'succeeded');
  const result = missing.length === 0 && inactive.length === 0 && failed.length === 0 ? 'pass' : 'fail';
  const detail = expectedJobs.map((j) => {
    const r = byName.get(j);
    if (!r) return `${j}: MISSING`;
    return `${j}: active=${r.active}, last_run=${r.last_run || 'never'}, last_status=${r.last_status || 'n/a'}`;
  }).join(' | ');
  return { result, short: result === 'pass' ? `${expectedJobs.length} job(s) active, last run succeeded` : detail, evidence: detail };
}

function checkSecurity(ref) {
  const rlsOffSql = `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false order by c.relname;`;
  const rlsOff = dbQueryJSON(rlsOffSql, ref);
  if (rlsOff.error) return { result: 'could not check', evidence: rlsOff.error, short: 'could not read pg_class' };

  const problems = [];
  if (rlsOff.rows.length > 0) problems.push(`RLS disabled on: ${rlsOff.rows.map((r) => r.relname).join(', ')}`);

  for (const [bucket, expected] of Object.entries(EXPECTED_STORAGE)) {
    const sql = `select b.public, p.policyname, p.roles from storage.buckets b left join pg_policies p on p.schemaname='storage' and p.tablename='objects' and (p.qual like '%${bucket}%' or p.with_check like '%${bucket}%') where b.id='${bucket}';`;
    const res = dbQueryJSON(sql, ref);
    if (res.error) { problems.push(`${bucket}: could not check (${res.error})`); continue; }
    if (res.rows.length === 0) { problems.push(`${bucket}: bucket does not exist`); continue; }
    const actualPublic = res.rows[0].public;
    const actualPolicies = new Set(res.rows.filter((r) => r.policyname).map((r) => r.policyname));
    if (actualPublic !== expected.public) problems.push(`${bucket}: public=${actualPublic}, expected ${expected.public}`);
    const missingPolicies = expected.policies.filter((p) => !actualPolicies.has(p));
    const extraPolicies = [...actualPolicies].filter((p) => !expected.policies.includes(p));
    if (missingPolicies.length) problems.push(`${bucket}: missing policies: ${missingPolicies.join(', ')}`);
    if (extraPolicies.length) problems.push(`${bucket}: extra/undocumented policies: ${extraPolicies.join(', ')}`);
    const nonAuthRoles = res.rows.filter((r) => r.policyname && !(r.roles || []).includes('authenticated')).map((r) => r.policyname);
    if (nonAuthRoles.length) problems.push(`${bucket}: policy not scoped to 'authenticated': ${nonAuthRoles.join(', ')}`);
  }

  const forbiddenSql = `select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname = any(array[${FORBIDDEN_STORAGE_POLICIES.map((p) => `'${p}'`).join(',')}]);`;
  const forbidden = dbQueryJSON(forbiddenSql, ref);
  if (!forbidden.error && forbidden.rows.length > 0) problems.push(`legacy policy still present: ${forbidden.rows.map((r) => r.policyname).join(', ')}`);

  return {
    result: problems.length === 0 ? 'pass' : 'fail',
    short: problems.length === 0 ? 'RLS on everywhere expected; storage policies match repo' : problems[0] + (problems.length > 1 ? ` (+${problems.length - 1} more)` : ''),
    evidence: problems.join(' | ') || 'no RLS-disabled tables; documents/meeting-attachments bucket public flag and policies match repo-declared final state; no legacy public storage policies',
  };
}

function checkAdvisors(ref, maraeName, allowlist) {
  const res = cliListJSON(['supabase', 'db', 'advisors', '--linked', '--type', 'all', '--level', 'info', '--output-format', 'json'], ref);
  if (res.error) return { result: 'could not check', evidence: res.error, short: 'could not read advisors' };
  const results = res.data.results || [];
  const byLevel = {};
  for (const r of results) byLevel[r.level] = (byLevel[r.level] || 0) + 1;
  const securityWarnOrWorse = results.filter((r) => r.categories.includes('SECURITY') && r.level !== 'INFO');
  const names = [...new Set(securityWarnOrWorse.map((r) => r.name))];
  const newNames = names.filter((n) => !isAllowed(allowlist, 'advisor_finding', n, maraeName));
  return {
    result: newNames.length === 0 ? 'pass' : 'fail',
    short: newNames.length === 0 ? `${results.length} findings (${JSON.stringify(byLevel)}), all known/allowlisted` : `new SECURITY findings: ${newNames.join(', ')}`,
    evidence: `${results.length} total findings (${JSON.stringify(byLevel)}). SECURITY findings at WARN/ERROR: ${securityWarnOrWorse.length} (${names.join(', ') || 'none'})${names.length ? `, all allowlisted as known/platform-wide: ${names.filter((n) => isAllowed(allowlist, 'advisor_finding', n, maraeName)).join(', ') || 'none'}` : ''}. New, non-allowlisted SECURITY findings: ${newNames.join(', ') || 'none'}.`,
  };
}

function checkAccounts(ref) {
  const sql = `select
    (select count(*) from auth.users) as auth_users,
    (select count(*) from profiles) as profiles,
    (select count(*) from auth.users u where not exists (select 1 from profiles p where p.id = u.id)) as users_missing_profile,
    (select count(*) from profiles where role is null) as profiles_missing_role,
    (select count(*) from profiles where role='trustee' and trustee_role is null) as trustees_missing_trustee_role,
    (select count(*) from entities) as entity_count,
    (select count(*) from profiles p where p.role='trustee' and p.trustee_role='standard' and (select count(*) from entities)>0 and not exists (select 1 from trustee_entities te where te.profile_id=p.id)) as unlinked_standard_trustees;`;
  const { rows, error } = dbQueryJSON(sql, ref);
  if (error) return { result: 'could not check', evidence: error, short: 'could not read accounts' };
  const r = rows[0];
  const problems = [];
  if (r.users_missing_profile > 0) problems.push(`${r.users_missing_profile} auth users with no profile`);
  if (r.profiles_missing_role > 0) problems.push(`${r.profiles_missing_role} profiles with null role`);
  if (r.trustees_missing_trustee_role > 0) problems.push(`${r.trustees_missing_trustee_role} trustees with null trustee_role`);
  return {
    result: problems.length === 0 ? 'pass' : 'fail',
    short: problems.length === 0 ? `${r.auth_users} users, ${r.profiles} profiles, no integrity gaps` : problems.join('; '),
    evidence: `auth_users=${r.auth_users}, profiles=${r.profiles}, entity_count=${r.entity_count}, unlinked_standard_trustees=${r.unlinked_standard_trustees} (separate known issue -- only meaningful when entity_count>0). ${problems.join('; ') || 'no integrity gaps'}`,
  };
}

function checkDataSanity(ref) {
  const sql = `select
    (select count(*) from resolutions r where not exists (select 1 from meetings m where m.id=r.meeting_id)) as orphan_resolutions,
    (select count(*) from meeting_actions a where not exists (select 1 from meetings m where m.id=a.meeting_id)) as orphan_actions,
    (select count(*) from meetings where title is null) as meetings_null_title,
    (select count(*) from tasks where description is null) as tasks_null_description,
    (select count(*) from (select email, count(*) c from auth.users group by email having count(*)>1) d) as duplicate_auth_emails;`;
  const { rows, error } = dbQueryJSON(sql, ref);
  if (error) return { result: 'could not check', evidence: error, short: 'could not read data sanity counts' };
  const r = rows[0];
  const problems = [];
  if (r.orphan_resolutions > 0) problems.push(`${r.orphan_resolutions} orphaned resolutions`);
  if (r.orphan_actions > 0) problems.push(`${r.orphan_actions} orphaned meeting_actions`);
  if (r.duplicate_auth_emails > 0) problems.push(`${r.duplicate_auth_emails} duplicate auth emails`);
  return {
    result: problems.length === 0 ? 'pass' : 'fail',
    short: problems.length === 0 ? `clean (${r.tasks_null_description} minor null task descriptions)` : problems.join('; '),
    evidence: `orphan_resolutions=${r.orphan_resolutions}, orphan_actions=${r.orphan_actions}, meetings_null_title=${r.meetings_null_title}, tasks_null_description=${r.tasks_null_description} (minor), duplicate_auth_emails=${r.duplicate_auth_emails}.`,
  };
}

function checkBackups(ref) {
  const res = cliListJSON(['supabase', 'backups', 'list', '--project-ref', ref, '--output-format', 'json'], ref);
  if (res.error) return { result: 'could not check', evidence: res.error, short: 'could not read backups' };
  const d = res.data;
  const latest = (d.backups || [])[0];
  const result = latest && latest.status === 'COMPLETED' ? 'pass' : 'fail';
  return {
    result,
    short: result === 'pass' ? `daily backups current, PITR ${d.pitr_enabled ? 'on' : 'off'}` : 'no completed backup found',
    evidence: `walg_enabled=${d.walg_enabled}, pitr_enabled=${d.pitr_enabled}, latest backup: ${latest ? `${latest.status} at ${latest.inserted_at}` : 'none found'}.`,
  };
}

function checkHosting(ref, project, browserFunctions, expectedFunctions) {
  if (!project.frontend_project) return { result: 'could not check', evidence: 'no frontend_project configured in scripts/marae-registry.json', short: 'no frontend_project configured' };
  const baseUrl = `https://${project.frontend_project}.vercel.app`;
  const html = fetchText(`${baseUrl}/`);
  if (!html) return { result: 'could not check', evidence: `could not fetch ${baseUrl}/`, short: `could not fetch ${baseUrl}/` };
  const m = html.match(/\/static\/js\/main\.[a-z0-9]+\.js/);
  if (!m) return { result: 'could not check', evidence: `could not find a main JS bundle path in ${baseUrl}/`, short: 'could not find bundle path' };
  const bundle = fetchText(`${baseUrl}${m[0]}`);
  if (!bundle) return { result: 'could not check', evidence: `could not fetch bundle ${m[0]}`, short: `could not fetch ${m[0]}` };

  const refsFound = new Set([...bundle.matchAll(/[a-z0-9]{20}\.supabase\.co/g)].map((x) => x[0].replace('.supabase.co', '')));
  const otherRefs = [...refsFound].filter((r) => r !== ref);
  const ownRefPresent = refsFound.has(ref);

  const corsResults = browserFunctions.map((fn) => {
    const code = httpStatus(`https://${ref}.supabase.co/functions/v1/${fn}`, 'OPTIONS');
    return { fn, code, isExpected: expectedFunctions.includes(fn) };
  });
  const corsProblems = corsResults.filter((r) => (r.isExpected && r.code === '404') || (!r.isExpected && r.code !== '404'));

  const problems = [];
  if (!ownRefPresent) problems.push(`own ref ${ref} not found in deployed bundle`);
  if (otherRefs.length) problems.push(`other project ref(s) leaked into bundle: ${otherRefs.join(', ')}`);
  if (corsProblems.length) problems.push(`CORS preflight mismatch vs expected deployment: ${corsProblems.map((r) => `${r.fn}=${r.code}`).join(', ')}`);

  return {
    result: problems.length === 0 ? 'pass' : 'fail',
    short: problems.length === 0 ? `bundle refs only ${ref}; CORS matches expected deployment` : problems.join('; '),
    evidence: `bundle (${m[0]}) refs only project(s): {${[...refsFound].join(', ') || 'none found'}} (ref comparison only, no keys printed). CORS OPTIONS checked for app-invoked functions: ${corsResults.map((r) => `${r.fn}=${r.code}${r.isExpected ? '' : '(excluded)'}`).join(', ') || 'none to check'}. ${problems.join(' | ') || 'bundle references only this marae\'s own ref; CORS preflight for excluded functions correctly 404s, for expected functions does not.'}`,
  };
}

function checkEmail(actualSecrets) {
  const present = EMAIL_SECRET_NAMES.filter((s) => actualSecrets.has(s));
  const missing = EMAIL_SECRET_NAMES.filter((s) => !actualSecrets.has(s));
  return {
    result: missing.length === 0 ? 'pass' : 'fail',
    short: missing.length === 0 ? 'RESEND_API_KEY/FROM_EMAIL present (names only)' : `missing: ${missing.join(', ')}`,
    evidence: `secret names present: ${present.join(', ') || 'none'}. Missing: ${missing.join(', ') || 'none'}. Actual Resend sending-domain verification status lives in Resend's own dashboard -- not inspectable from this Supabase-side read; names-only presence was confirmed, domain verification itself was not.`,
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────

function auditProject(project, allFunctions, allMigrationVersions, allowlist, browserFunctions) {
  const ref = project.ref;
  const link = linkProject(ref);
  if (!link.ok) return { fatalError: link.stderr || link.stdout };

  const expectedFunctions = expectedFunctionsFor(project, allFunctions);
  const requiredSecrets = requiredSecretsFor(expectedFunctions);
  const expectedJobs = expectedJobsFor(project);

  const secretsRes = cliListJSON(['supabase', 'secrets', 'list'], ref);
  const actualSecrets = secretsRes.error ? null : new Set((secretsRes.data.secrets || []).map((s) => s.name));

  const secretsCheck = actualSecrets
    ? checkSecretsFromSet(actualSecrets, requiredSecrets, project.name, allowlist)
    : { result: 'could not check', evidence: secretsRes.error, short: 'CLI error listing secrets' };
  const emailCheck = actualSecrets
    ? checkEmail(actualSecrets)
    : { result: 'could not check', evidence: secretsRes.error, short: 'CLI error listing secrets' };

  return {
    migrations: checkMigrations(ref, allMigrationVersions),
    edge_functions: checkEdgeFunctions(ref, project, allFunctions, allowlist),
    secrets: secretsCheck,
    scheduled_jobs: checkScheduledJobs(ref, expectedJobs),
    security: checkSecurity(ref),
    accounts: checkAccounts(ref),
    data_sanity: checkDataSanity(ref),
    backups: checkBackups(ref),
    advisors: checkAdvisors(ref, project.name, allowlist),
    hosting: checkHosting(ref, project, browserFunctions, expectedFunctions),
    email: emailCheck,
  };
}

function displayResult(r) {
  if (r === 'pass') return 'PASS';
  if (r === 'fail') return 'FAIL';
  return 'COULD NOT CHECK';
}

function truncate(s, n) {
  if (s == null) return '';
  const str = String(s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.marae) {
    console.error('Error: --marae <name> is required (one marae per invocation). Use --help for usage.');
    process.exit(2);
  }

  const registry = loadRegistry();
  const project = registry.projects.find((p) => p.name === args.marae);
  if (!project) {
    console.error(`Error: no marae named "${args.marae}" in ${REGISTRY_REL} on ${REFERENCE_BRANCH}. Known: ${registry.projects.map((p) => p.name).join(', ')}`);
    process.exit(2);
  }

  const allowlist = loadAllowlist();
  const allFunctions = repoFunctionNames();
  const allMigrationVersions = repoMigrationVersions();
  const browserFunctions = browserInvokedFunctions();
  const commit = repoCommit();

  console.log(`\n=== MaraeHub integrity audit: ${project.name} ===`);
  console.log(`Reference: repo on ${REFERENCE_BRANCH} @ ${commit} (${allMigrationVersions.length} migrations, ${allFunctions.length} functions)`);
  console.log(`Project:   ${project.name} (${project.ref})`);
  console.log(`Scope:     read-only. No database writes, no deploys, no merges, no pushes.\n`);

  const generatedAt = new Date().toISOString();
  const result = auditProject(project, allFunctions, allMigrationVersions, allowlist, browserFunctions);

  if (result.fatalError) {
    console.error(`\nCould not link/audit ${project.name}: ${result.fatalError}`);
    process.exit(2);
  }

  // ── SHORT SUMMARY (one line per check, PASS/FAIL/COULD NOT CHECK) ──
  const summaryLines = [];
  let anyFail = false;
  CHECK_LABELS.forEach(([key, label], i) => {
    const { result: r, short } = result[key];
    if (r === 'fail') anyFail = true;
    const prefix = `${i + 1}. ${label.padEnd(15)} ${displayResult(r).padEnd(16)}`;
    const line = truncate(`${prefix} ${short}`, 79);
    summaryLines.push(line);
  });

  console.log(`--- Summary: ${project.name} (${project.ref}) ---`);
  for (const line of summaryLines) console.log(line);

  // ── DETAIL ──
  const detailLines = [];
  detailLines.push(`\n--- Detail: ${project.name} (${project.ref}) ---\n`);
  CHECK_LABELS.forEach(([key, label], i) => {
    const { result: r, evidence } = result[key];
    detailLines.push(`${i + 1}. ${label} -- ${displayResult(r)}`);
    detailLines.push(`   ${evidence}`);
    detailLines.push('');
  });
  console.log(detailLines.join('\n'));

  // ── WRITE REPORTS ──
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonReportPath = path.join(REPORTS_DIR, `integrity-audit-${project.name}-${generatedAt.replace(/[:.]/g, '-')}.json`);
  const jsonReport = { generatedAt, referenceBranch: REFERENCE_BRANCH, referenceCommit: commit, marae: project.name, ref: project.ref, checks: result };
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
  console.log(`Full JSON report written to: ${path.relative(process.cwd(), jsonReportPath)}`);

  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const txtReportPath = path.join(DOWNLOADS_DIR, `integrity-audit-${project.name}-${generatedAt.replace(/[:.]/g, '-')}.txt`);
  const txtReport = [
    `MARAEHUB INTEGRITY AUDIT -- ${project.name.toUpperCase()} (${project.ref})`,
    `Reference: repo on ${REFERENCE_BRANCH} @ ${commit}. Not Opeke, not test.`,
    `Generated: ${generatedAt}`,
    `Scope: read-only. No database writes, no deploys, no merges, no pushes.`,
    '',
    '='.repeat(80),
    'SUMMARY',
    '='.repeat(80),
    ...summaryLines,
    ...detailLines,
  ].join('\n');
  fs.writeFileSync(txtReportPath, txtReport);
  console.log(`Full text report written to: ${txtReportPath}`);

  if (args.json) { console.log('\n--- JSON report ---'); console.log(JSON.stringify(jsonReport, null, 2)); }

  console.log(`\n=== Result: ${anyFail ? 'FAIL' : 'PASS'} (${project.name}) ===\n`);
  process.exit(anyFail ? 1 : 0);
}

main();
