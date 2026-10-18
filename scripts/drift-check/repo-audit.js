#!/usr/bin/env node
'use strict';

// Read-only integrity audit of a marae's Supabase project against the REPO
// itself as the reference (not another project) -- migrations, deployed
// function source, the secrets a function's own code requires, scheduled
// jobs declared in migrations, RLS/storage security posture, account
// integrity, data sanity, backups, and the Supabase advisors.
//
// Unlike drift-check.js (project vs. project), this compares each marae
// against what the repo on this branch actually declares. Catalog/metadata
// reads and `supabase` CLI list/download/advisors/backups commands only --
// never a row's business data, never a secret value.
//
// See README.md for usage.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO_ROOT = path.join(ROOT, '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'scripts', 'marae-registry.json');
const REPORTS_DIR = path.join(ROOT, 'reports');

// Platform-managed secrets present on every Supabase project automatically --
// not something a human configures, so never reported as missing/unexpected.
const PLATFORM_AUTO_SECRETS = new Set([
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL', 'SUPABASE_JWKS', 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_SECRET_KEYS',
]);

// The 3 cron jobs this codebase's migrations ever schedule (grep for
// 'maraehub-[a-z-]+' across supabase/migrations/*.sql to re-derive if this
// ever changes).
const ALL_CRON_JOBS = ['maraehub-check-deadlines', 'maraehub-notify-trustees', 'maraehub-lock-kpi-snapshot'];

// Expected final storage.objects state for the two buckets with
// migration-declared RLS, after tracing every migration that touches them
// in order (see supabase/migrations/20260816020000_create_meeting_attachments_bucket.sql
// and the 2026-10-10/11 documents-bucket hardening migrations
// 20261010000000 / 20261010010000 / 20261011000000). A bucket/policy
// change in the repo needs a matching one-line update here.
const EXPECTED_STORAGE = {
  'meeting-attachments': { public: false, policies: ['meeting-attachments: allow all uploads'] },
  documents: {
    public: true,
    policies: ['documents: authenticated insert', 'documents: authenticated update', 'documents: authenticated delete', 'documents: authenticated read'],
  },
};
// Legacy policy that every migration-aware project should have had removed.
const FORBIDDEN_STORAGE_POLICIES = ['Allow all maraehub'];

function parseArgs(argv) {
  const args = { only: null, json: false, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length).split(',').map((s) => s.trim());
    else if (arg === '--json') args.json = true;
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/drift-check/repo-audit.js [--only=name1,name2] [--json]

Audits each marae in scripts/marae-registry.json against the REPO on this
branch (migrations, supabase/functions source, the registry's expected
deployment, and each function's own required secrets) -- not against
another project. Checks: migrations, edge functions, secrets, scheduled
jobs, RLS/storage security, accounts, data sanity, backups, advisors.

  --only=name1,name2   Only audit these marae-registry.json project names.
  --json                Also print the full machine-readable report to stdout.
`);
}

function run(cmd, args, ref) {
  const label = ref ? `  (project: ${ref})` : '';
  console.log(`$ ${cmd} ${args.join(' ')}${label}`);
  const res = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
  if (res.error) return { ok: false, stdout: '', stderr: String(res.error) };
  if (res.status !== 0) return { ok: false, stdout: res.stdout || '', stderr: cleanStderr(res.stderr || '') };
  return { ok: true, stdout: res.stdout || '', stderr: res.stderr || '' };
}

const CLI_NOISE = [/^Initialising login role\.\.\.$/, /^A new version of Supabase CLI/, /^We recommend updating/, /^Try rerunning the command/, /^Connecting to remote database/, /^Skipping migration/];
function cleanStderr(stderr) {
  return stderr.split('\n').filter((l) => l.trim() && !CLI_NOISE.some((re) => re.test(l.trim()))).join('\n').trim();
}

function linkProject(ref) { return run('npx', ['supabase', 'link', '--project-ref', ref], ref); }

function dbQueryJSON(sql, ref) {
  const res = run('npx', ['supabase', 'db', 'query', '--linked', sql], ref);
  if (!res.ok) return { error: (res.stderr || res.stdout || 'unknown error').trim() };
  try { return { rows: JSON.parse(res.stdout).rows || [] }; }
  catch (e) { return { error: `could not parse CLI output as JSON: ${e.message}` }; }
}

function cliListJSON(args, ref) {
  const res = run('npx', [...args], ref);
  if (!res.ok) return { error: (res.stderr || res.stdout || 'unknown error').trim() };
  try { return { data: JSON.parse(res.stdout) }; }
  catch (e) { return { error: `could not parse CLI output as JSON: ${e.message}` }; }
}

// ── REPO-SIDE REFERENCE (local files only, no project needed) ─────────────

function repoMigrationVersions() {
  return fs.readdirSync(path.join(REPO_ROOT, 'supabase', 'migrations'))
    .filter((f) => /^\d+_/.test(f))
    .map((f) => f.match(/^(\d+)_/)[1]);
}

function repoFunctionNames() {
  return fs.readdirSync(path.join(REPO_ROOT, 'supabase', 'functions'))
    .filter((f) => !f.startsWith('_') && !f.includes('.') && fs.statSync(path.join(REPO_ROOT, 'supabase', 'functions', f)).isDirectory());
}

function functionSecrets(name) {
  const file = path.join(REPO_ROOT, 'supabase', 'functions', name, 'index.ts');
  if (!fs.existsSync(file)) return new Set();
  const text = fs.readFileSync(file, 'utf8');
  const matches = text.matchAll(/Deno\.env\.get\('([A-Z_]+)'\)/g);
  return new Set([...matches].map((m) => m[1]));
}

function loadRegistry() { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }

function expectedFunctionsFor(project, allFunctions) {
  const excluded = new Set(project.excluded_functions.map((f) => f.name));
  return allFunctions.filter((f) => !excluded.has(f));
}

function requiredSecretsFor(expectedFunctions) {
  const set = new Set();
  for (const fn of expectedFunctions) for (const s of functionSecrets(fn)) if (!PLATFORM_AUTO_SECRETS.has(s)) set.add(s);
  return set;
}

function expectedJobsFor(project) {
  const excluded = new Set(project.excluded_jobs.map((j) => j.name));
  return ALL_CRON_JOBS.filter((j) => !excluded.has(j));
}

// ── CHECKS ──────────────────────────────────────────────────────────────

function checkMigrations(ref, localVersions) {
  const res = run('npx', ['supabase', 'migration', 'list', '--linked'], ref);
  if (!res.ok) return { result: 'could not check', evidence: res.stderr || res.stdout };
  const remote = new Set();
  const seenLocal = new Set();
  for (const line of res.stdout.split('\n')) {
    const cols = line.split('|').map((c) => c.trim());
    if (cols.length < 2) continue;
    const [l, r] = cols;
    if (!/^\d+$/.test(l)) continue;
    seenLocal.add(l);
    if (/^\d+$/.test(r)) remote.add(r);
  }
  const local = new Set(localVersions);
  const missing = [...local].filter((v) => !remote.has(v)).sort();
  const extra = [...remote].filter((v) => !local.has(v)).sort();
  const result = missing.length === 0 && extra.length === 0 ? 'pass' : 'fail';
  return {
    result,
    evidence: `${local.size} local, ${remote.size} tracked-applied, ${missing.length} missing, ${extra.length} extra (no local file). Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}. NOTE: "missing" means untracked in the migration bookkeeping table -- verify against live schema before assuming the DDL never ran; this project has a known history of real changes applied via direct db query that were never recorded as migrations.`,
  };
}

function checkEdgeFunctions(ref, project, allFunctions) {
  const expected = expectedFunctionsFor(project, allFunctions);
  const excluded = project.excluded_functions.map((f) => f.name);
  const listRes = cliListJSON(['supabase', 'functions', 'list'], ref);
  if (listRes.error) return { result: 'could not check', evidence: listRes.error };
  const deployed = new Map(listRes.data.map((f) => [f.name, f.status]));

  const missing = expected.filter((f) => !deployed.has(f));
  const notActive = expected.filter((f) => deployed.has(f) && deployed.get(f) !== 'ACTIVE');
  const excludedButDeployed = excluded.filter((f) => deployed.has(f));

  const tmpDir = fs.mkdtempSync('/tmp/repo-audit-fn-');
  const dlRes = run('npx', ['supabase', 'functions', 'download', '--project-ref', ref, '--workdir', tmpDir, '--use-api'], ref);
  const mismatched = [];
  if (dlRes.ok) {
    for (const fn of expected) {
      if (!deployed.has(fn)) continue;
      const repoFile = path.join(REPO_ROOT, 'supabase', 'functions', fn, 'index.ts');
      const dlFile = path.join(tmpDir, 'supabase', 'functions', fn, 'index.ts');
      if (!fs.existsSync(dlFile)) continue;
      const a = fs.readFileSync(repoFile, 'utf8');
      const b = fs.readFileSync(dlFile, 'utf8');
      if (a !== b) mismatched.push(fn);
    }
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const result = missing.length === 0 && notActive.length === 0 && excludedButDeployed.length === 0 && mismatched.length === 0 ? 'pass' : 'fail';
  return {
    result,
    evidence: `${expected.length} expected, ${expected.length - missing.length} deployed. Missing: ${missing.join(', ') || 'none'}. Not ACTIVE: ${notActive.join(', ') || 'none'}. Excluded-but-deployed: ${excludedButDeployed.join(', ') || 'none'}. Source mismatch vs repo (hash ignored): ${mismatched.join(', ') || 'none'}.`,
  };
}

function checkSecrets(ref, requiredSecrets) {
  const res = cliListJSON(['supabase', 'secrets', 'list'], ref);
  if (res.error) return { result: 'could not check', evidence: res.error };
  const actual = new Set((res.data.secrets || []).map((s) => s.name));
  const missing = [...requiredSecrets].filter((s) => !actual.has(s)).sort();
  const unexpected = [...actual].filter((s) => !requiredSecrets.has(s) && !PLATFORM_AUTO_SECRETS.has(s)).sort();
  return {
    result: missing.length === 0 ? 'pass' : 'fail',
    evidence: `${requiredSecrets.size} required, ${requiredSecrets.size - missing.length} present. Missing names: ${missing.join(', ') || 'none'}. Unexpected names (present, not required by any expected function): ${unexpected.join(', ') || 'none'}.`,
  };
}

function checkScheduledJobs(ref, expectedJobs) {
  const sql = `select jobname, schedule, active, (select max(start_time) from cron.job_run_details jrd where jrd.jobid = j.jobid) as last_run, (select status from cron.job_run_details jrd where jrd.jobid = j.jobid order by start_time desc limit 1) as last_status from cron.job j where jobname = any(array[${expectedJobs.map((j) => `'${j}'`).join(',')}]) order by jobname;`;
  const { rows, error } = dbQueryJSON(sql, ref);
  if (error) return { result: 'could not check', evidence: error };
  const byName = new Map(rows.map((r) => [r.jobname, r]));
  const missing = expectedJobs.filter((j) => !byName.has(j));
  const inactive = expectedJobs.filter((j) => byName.has(j) && !byName.get(j).active);
  const noRun = expectedJobs.filter((j) => byName.has(j) && !byName.get(j).last_run);
  const failed = expectedJobs.filter((j) => byName.has(j) && byName.get(j).last_status && byName.get(j).last_status !== 'succeeded');
  const result = missing.length === 0 && inactive.length === 0 && failed.length === 0 ? 'pass' : 'fail';
  const detail = expectedJobs.map((j) => {
    const r = byName.get(j);
    if (!r) return `${j}: MISSING`;
    return `${j}: active=${r.active}, last_run=${r.last_run || 'never'}, last_status=${r.last_status || 'n/a'}`;
  }).join(' | ');
  return { result, evidence: detail };
}

function checkSecurity(ref) {
  const rlsOffSql = `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false order by c.relname;`;
  const rlsOff = dbQueryJSON(rlsOffSql, ref);
  if (rlsOff.error) return { result: 'could not check', evidence: rlsOff.error };

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

  return { result: problems.length === 0 ? 'pass' : 'fail', evidence: problems.join(' | ') || 'no RLS-disabled tables; documents/meeting-attachments bucket public flag and policies match repo-declared final state; no legacy public storage policies' };
}

function checkAdvisors(ref) {
  const res = cliListJSON(['supabase', 'db', 'advisors', '--linked', '--type', 'all', '--level', 'info', '--output-format', 'json'], ref);
  if (res.error) return { result: 'could not check', evidence: res.error };
  const results = res.data.results || [];
  const byLevel = {};
  for (const r of results) byLevel[r.level] = (byLevel[r.level] || 0) + 1;
  const securityWarnOrWorse = results.filter((r) => r.categories.includes('SECURITY') && r.level !== 'INFO');
  return {
    result: securityWarnOrWorse.length === 0 ? 'pass' : 'fail',
    evidence: `${results.length} total findings (${JSON.stringify(byLevel)}). SECURITY findings at WARN/ERROR: ${securityWarnOrWorse.length} (${[...new Set(securityWarnOrWorse.map((r) => r.name))].join(', ') || 'none'}).`,
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
  if (error) return { result: 'could not check', evidence: error };
  const r = rows[0];
  const problems = [];
  if (r.users_missing_profile > 0) problems.push(`${r.users_missing_profile} auth users with no profile`);
  if (r.profiles_missing_role > 0) problems.push(`${r.profiles_missing_role} profiles with null role`);
  if (r.trustees_missing_trustee_role > 0) problems.push(`${r.trustees_missing_trustee_role} trustees with null trustee_role`);
  return {
    result: problems.length === 0 ? 'pass' : 'fail',
    evidence: `auth_users=${r.auth_users}, profiles=${r.profiles}, entity_count=${r.entity_count}, unlinked_standard_trustees=${r.unlinked_standard_trustees} (separate known issue, not failed here unless 0 entities). ${problems.join('; ') || 'no integrity gaps'}`,
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
  if (error) return { result: 'could not check', evidence: error };
  const r = rows[0];
  const problems = [];
  if (r.orphan_resolutions > 0) problems.push(`${r.orphan_resolutions} orphaned resolutions`);
  if (r.orphan_actions > 0) problems.push(`${r.orphan_actions} orphaned meeting_actions`);
  if (r.duplicate_auth_emails > 0) problems.push(`${r.duplicate_auth_emails} duplicate auth emails`);
  return {
    result: problems.length === 0 ? 'pass' : 'fail',
    evidence: `orphan_resolutions=${r.orphan_resolutions}, orphan_actions=${r.orphan_actions}, meetings_null_title=${r.meetings_null_title}, tasks_null_description=${r.tasks_null_description}, duplicate_auth_emails=${r.duplicate_auth_emails}.`,
  };
}

function checkBackups(ref) {
  const res = cliListJSON(['supabase', 'backups', 'list', '--project-ref', ref, '--output-format', 'json'], null);
  if (res.error) return { result: 'could not check', evidence: res.error };
  const d = res.data;
  const latest = (d.backups || [])[0];
  return {
    result: latest && latest.status === 'COMPLETED' ? 'pass' : 'fail',
    evidence: `walg_enabled=${d.walg_enabled}, pitr_enabled=${d.pitr_enabled}, latest backup: ${latest ? `${latest.status} at ${latest.inserted_at}` : 'none found'}.`,
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────

function auditProject(project, allFunctions, allMigrationVersions) {
  const ref = project.ref;
  const link = linkProject(ref);
  if (!link.ok) return { fatalError: link.stderr || link.stdout };

  const expectedFunctions = expectedFunctionsFor(project, allFunctions);
  const requiredSecrets = requiredSecretsFor(expectedFunctions);
  const expectedJobs = expectedJobsFor(project);

  return {
    migrations: checkMigrations(ref, allMigrationVersions),
    edge_functions: checkEdgeFunctions(ref, project, allFunctions),
    secrets: checkSecrets(ref, requiredSecrets),
    scheduled_jobs: checkScheduledJobs(ref, expectedJobs),
    security: checkSecurity(ref),
    accounts: checkAccounts(ref),
    data_sanity: checkDataSanity(ref),
    backups: checkBackups(ref),
    advisors: checkAdvisors(ref),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }

  const registry = loadRegistry();
  let projects = registry.projects;
  if (args.only) projects = projects.filter((p) => args.only.includes(p.name));

  const allFunctions = repoFunctionNames();
  const allMigrationVersions = repoMigrationVersions();

  console.log(`\n=== MaraeHub repo-reference audit ===`);
  console.log(`Reference: the repo on this branch (${allMigrationVersions.length} migrations, ${allFunctions.length} functions)`);
  console.log(`Projects:  ${projects.map((p) => `${p.name} (${p.ref})`).join(', ')}\n`);

  const report = { generatedAt: new Date().toISOString(), projects: {} };
  let anyFail = false;

  for (const project of projects) {
    console.log(`\n--- Auditing ${project.name} ---`);
    const result = auditProject(project, allFunctions, allMigrationVersions);
    if (result.fatalError) {
      console.log(`Could not link/audit ${project.name}: ${result.fatalError}`);
      report.projects[project.name] = { fatalError: result.fatalError };
      anyFail = true;
      continue;
    }
    report.projects[project.name] = result;

    console.log(`\n## ${project.name}\n`);
    for (const [check, { result: r, evidence }] of Object.entries(result)) {
      console.log(`${check.padEnd(16)} ${r.toUpperCase().padEnd(16)} ${evidence}`);
      if (r !== 'pass') anyFail = true;
    }
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `repo-audit-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull JSON report written to: ${path.relative(process.cwd(), reportPath)}`);

  if (args.json) { console.log('\n--- JSON report ---'); console.log(JSON.stringify(report, null, 2)); }

  process.exit(anyFail ? 1 : 0);
}

main();
