#!/usr/bin/env node
'use strict';

// Read-only database drift check for MaraeHub.
//
// Compares every marae's Supabase project against the reference project
// (Opeke) across 8 categories: tables/columns, functions, RLS/policies,
// triggers/indexes, Edge Functions, secret NAMES, scheduled (cron) jobs,
// and applied migrations. Every check is a catalog/metadata read
// (information_schema, pg_catalog, pg_policies, cron.job, or a `supabase`
// CLI list/link command) -- nothing here ever reads a row's business data.
//
// See README.md for usage. Run with --help for flags.

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const REGISTRY_PATH = path.join(ROOT, 'registry.json');
const ALLOWLIST_PATH = path.join(ROOT, 'allowlist.json');
const REPORTS_DIR = path.join(ROOT, 'reports');

// ── CLI ARGS ─────────────────────────────────────────────────────────────

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
Usage: node scripts/drift-check/drift-check.js [--only=name1,name2] [--json]

  --only=name1,name2   Only check these maraes (by registry.json "name"),
                        instead of every non-reference project.
  --json                Also print the full machine-readable report to stdout.

Reads project refs from registry.json and intentional-difference exceptions
from allowlist.json. Never writes to a database, never deploys. Requires an
already-authenticated \`supabase\` CLI (run \`npx supabase login\` once,
interactively, if needed -- this script never asks for or handles a key).
`);
}

// ── SHELL HELPERS (every external command is echoed before it runs) ──────

const CLI_NOISE_LINES = [
  /^Initialising login role\.\.\.$/,
  /^A new version of Supabase CLI is available/,
  /^We recommend updating regularly/,
  /^Try rerunning the command with --debug/,
];

function cleanStderr(stderr) {
  return stderr
    .split('\n')
    .filter((line) => line.trim() && !CLI_NOISE_LINES.some((re) => re.test(line.trim())))
    .join('\n')
    .trim();
}

function run(cmd, args, ref) {
  const label = ref ? `  (project: ${ref})` : '';
  console.log(`$ ${cmd} ${args.join(' ')}${label}`);
  const res = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
  if (res.error) return { ok: false, stdout: '', stderr: String(res.error) };
  if (res.status !== 0) return { ok: false, stdout: res.stdout || '', stderr: cleanStderr(res.stderr || '') };
  return { ok: true, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function linkProject(ref) {
  return run('npx', ['supabase', 'link', '--project-ref', ref], ref);
}

function dbQueryJSON(sql, ref) {
  const res = run('npx', ['supabase', 'db', 'query', '--linked', sql], ref);
  if (!res.ok) return { error: (res.stderr || res.stdout || 'unknown error').trim() };
  try {
    const parsed = JSON.parse(res.stdout);
    return { rows: parsed.rows || [] };
  } catch (e) {
    return { error: `could not parse CLI output as JSON: ${e.message}` };
  }
}

function cliListJSON(args, ref) {
  const res = run('npx', ['supabase', ...args], ref);
  if (!res.ok) return { error: (res.stderr || res.stdout || 'unknown error').trim() };
  try {
    return { data: JSON.parse(res.stdout) };
  } catch (e) {
    return { error: `could not parse CLI output as JSON: ${e.message}` };
  }
}

// `supabase migration list --linked` is a plain text table, not JSON.
function migrationListVersions(ref) {
  const res = run('npx', ['supabase', 'migration', 'list', '--linked'], ref);
  if (!res.ok) return { error: (res.stderr || res.stdout || 'unknown error').trim() };
  const tracked = new Set();
  const localOnly = new Set();
  for (const line of res.stdout.split('\n')) {
    const cols = line.split('|').map((c) => c.trim());
    if (cols.length < 2) continue;
    const [local, remote] = cols;
    if (!/^\d+$/.test(local)) continue; // header/separator/blank lines
    if (remote && /^\d+$/.test(remote)) tracked.add(local);
    else localOnly.add(local);
  }
  return { tracked, localOnly };
}

// ── CATEGORY 1-4: ONE CATALOG QUERY COVERS TABLES/COLUMNS/FUNCTIONS/RLS/POLICIES/TRIGGERS/INDEXES ──

const CATALOG_SQL = `
select 'table' as kind, table_name as item, 'base_table' as def
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'column',
       table_name || '.' || column_name,
       data_type || '|nullable=' || is_nullable || '|default=' || coalesce(column_default, 'NULL')
  from information_schema.columns
  where table_schema = 'public'
union all
select 'function',
       p.proname || '(' || pg_get_function_arguments(p.oid) || ')',
       'returns=' || pg_get_function_result(p.oid) || '|secdef=' || p.prosecdef::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
union all
select 'rls_enabled', c.relname, c.relrowsecurity::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
union all
select 'policy',
       tablename || ':' || policyname,
       cmd || '|qual=' || coalesce(qual, 'NULL') || '|check=' || coalesce(with_check, 'NULL')
  from pg_policies
  where schemaname = 'public'
union all
select 'trigger',
       event_object_table || ':' || trigger_name || ':' || event_manipulation,
       action_timing || ' => ' || action_statement
  from information_schema.triggers
  where trigger_schema = 'public'
union all
select 'index', tablename || ':' || indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
order by 1, 2;
`.trim();

function fetchCatalog(ref) {
  const { rows, error } = dbQueryJSON(CATALOG_SQL, ref);
  if (error) return { error };
  const byKind = {};
  for (const row of rows) {
    const kind = row.kind;
    (byKind[kind] = byKind[kind] || new Map()).set(row.item, row.def);
  }
  return { byKind };
}

// ── CATEGORY 5: EDGE FUNCTIONS ─────────────────────────────────────────────
//
// Compares a hash of the actual downloaded source text, not the platform's
// own `ezbr_sha256` bundle hash. The bundle hash changes with build
// metadata (e.g. bundler non-determinism) even when the source is
// byte-identical, which produced false "different" findings in the first
// version of this check. Downloading once per project and hashing the
// real `index.ts` content is slower but reports drift that's actually
// there.

function fetchEdgeFunctions(ref) {
  const { data, error } = cliListJSON(['functions', 'list'], ref);
  if (error) return { error };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-check-fn-'));
  const dlRes = run('npx', ['supabase', 'functions', 'download', '--project-ref', ref, '--workdir', tmpDir, '--use-api'], ref);
  const map = new Map();
  for (const fn of data) {
    let sourceHash = 'unavailable (download failed)';
    if (dlRes.ok) {
      const srcFile = path.join(tmpDir, 'supabase', 'functions', fn.name, 'index.ts');
      if (fs.existsSync(srcFile)) {
        sourceHash = crypto.createHash('sha256').update(fs.readFileSync(srcFile, 'utf8')).digest('hex').slice(0, 16);
      }
    }
    map.set(fn.name, `status=${fn.status}|verify_jwt=${fn.verify_jwt}|source_sha256=${sourceHash}`);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { map };
}

// ── CATEGORY 6: SECRET NAMES ONLY (never values) ────────────────────────────

function fetchSecretNames(ref) {
  const { data, error } = cliListJSON(['secrets', 'list'], ref);
  if (error) return { error };
  const map = new Map();
  for (const s of data.secrets || []) {
    map.set(s.name, 'present'); // value is deliberately never read here
  }
  return { map };
}

// ── CATEGORY 7: SCHEDULED (CRON) JOBS ───────────────────────────────────────

function fetchCronJobs(ref) {
  const sql = `select jobname, schedule, active from cron.job order by jobname;`;
  const { rows, error } = dbQueryJSON(sql, ref);
  if (error) return { error };
  const map = new Map();
  for (const r of rows) map.set(r.jobname, `schedule=${r.schedule}|active=${r.active}`);
  return { map };
}

// ── CATEGORY 8: APPLIED MIGRATIONS ──────────────────────────────────────────

function fetchMigrations(ref) {
  const { tracked, localOnly, error } = migrationListVersions(ref);
  if (error) return { error };
  const map = new Map();
  for (const v of tracked) map.set(v, 'tracked-applied');
  for (const v of localOnly) map.set(v, 'local-only-untracked');
  return { map, note: 'Compares the migration TRACKING table, not live schema -- a version missing here can mean "never applied" or just "applied directly, never recorded." Treat any difference as a lead to verify, not a confirmed gap.' };
}

// ── GENERIC DIFF ─────────────────────────────────────────────────────────

function diffMaps(categoryLabel, refMap, maraeMap) {
  const findings = [];
  const allItems = new Set([...refMap.keys(), ...maraeMap.keys()]);
  for (const item of allItems) {
    const inRef = refMap.has(item);
    const inMarae = maraeMap.has(item);
    let status;
    if (inRef && !inMarae) status = 'missing';
    else if (!inRef && inMarae) status = 'extra';
    else if (refMap.get(item) !== maraeMap.get(item)) status = 'different';
    else status = 'same';
    findings.push({ category: categoryLabel, item, refValue: refMap.get(item) ?? null, maraeValue: maraeMap.get(item) ?? null, status });
  }
  return findings;
}

// ── MAIN ─────────────────────────────────────────────────────────────────

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function isAllowlisted(allowlist, categoryLabel, item, maraeName) {
  return allowlist.entries.some(
    (e) => e.category === categoryLabel && e.item === item && (e.marae === maraeName || e.marae === '*')
  );
}

function collectAllForProject(ref) {
  const linkRes = linkProject(ref);
  if (!linkRes.ok) {
    return { fatalError: (linkRes.stderr || linkRes.stdout || 'link failed').trim() };
  }

  const catalog = fetchCatalog(ref);
  const edgeFns = fetchEdgeFunctions(ref);
  const secrets = fetchSecretNames(ref);
  const cron = fetchCronJobs(ref);
  const migrations = fetchMigrations(ref);

  const byCategory = {};
  const couldNotCheck = [];

  const kinds = ['table', 'column', 'function', 'rls_enabled', 'policy', 'trigger', 'index'];
  if (catalog.error) {
    for (const k of kinds) couldNotCheck.push({ category: k, reason: catalog.error });
  } else {
    for (const k of kinds) byCategory[k] = catalog.byKind[k] || new Map();
  }

  if (edgeFns.error) couldNotCheck.push({ category: 'edge_function', reason: edgeFns.error });
  else byCategory.edge_function = edgeFns.map;

  if (secrets.error) couldNotCheck.push({ category: 'secret_name', reason: secrets.error });
  else byCategory.secret_name = secrets.map;

  if (cron.error) couldNotCheck.push({ category: 'cron_job', reason: cron.error });
  else byCategory.cron_job = cron.map;

  if (migrations.error) couldNotCheck.push({ category: 'migration', reason: migrations.error });
  else byCategory.migration = migrations.map;

  return { byCategory, couldNotCheck };
}

function formatTable(rows, columns) {
  const widths = columns.map((c) => Math.max(c.label.length, ...rows.map((r) => String(r[c.key] ?? '').length)));
  const line = (cells) => cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ');
  const out = [line(columns.map((c) => c.label)), line(widths.map((w) => '-'.repeat(w)))];
  for (const r of rows) out.push(line(columns.map((c) => r[c.key] ?? '')));
  return out.join('\n');
}

function truncate(s, n) {
  if (s == null) return '';
  const str = String(s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const registry = loadJSON(REGISTRY_PATH);
  const allowlist = loadJSON(ALLOWLIST_PATH);

  const reference = registry.projects.find((p) => p.role === 'reference');
  if (!reference) {
    console.error('registry.json has no project with role "reference" -- cannot continue.');
    process.exit(2);
  }

  let maraes = registry.projects.filter((p) => p.role !== 'reference');
  if (args.only) maraes = maraes.filter((p) => args.only.includes(p.name));

  console.log(`\n=== MaraeHub drift check ===`);
  console.log(`Reference: ${reference.name} (${reference.ref})`);
  console.log(`Maraes:    ${maraes.map((m) => `${m.name} (${m.ref})`).join(', ')}\n`);

  console.log(`--- Collecting reference: ${reference.name} ---`);
  const refData = collectAllForProject(reference.ref);
  if (refData.fatalError) {
    console.error(`Could not link/read the reference project: ${refData.fatalError}`);
    process.exit(2);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reference: { name: reference.name, ref: reference.ref },
    maraes: {},
    couldNotCheck: {
      [reference.name]: refData.couldNotCheck,
    },
  };

  const allFindings = []; // for the printed summary table
  let driftCount = 0;
  const allowedCount = { n: 0 };

  for (const marae of maraes) {
    console.log(`\n--- Collecting ${marae.name} ---`);
    const maraeData = collectAllForProject(marae.ref);
    if (maraeData.fatalError) {
      report.couldNotCheck[marae.name] = [{ category: '*', reason: maraeData.fatalError }];
      console.log(`Could not link/read ${marae.name}: ${maraeData.fatalError}`);
      continue;
    }
    report.couldNotCheck[marae.name] = maraeData.couldNotCheck;

    const categories = new Set([...Object.keys(refData.byCategory), ...Object.keys(maraeData.byCategory)]);
    const maraeFindings = [];
    for (const category of categories) {
      const refMap = refData.byCategory[category];
      const maraeMap = maraeData.byCategory[category];
      if (!refMap || !maraeMap) continue; // one side couldn't be checked; already recorded above
      const findings = diffMaps(category, refMap, maraeMap);
      for (const f of findings) {
        if (f.status === 'same') continue;
        const allowed = isAllowlisted(allowlist, f.category, f.item, marae.name);
        const finding = { ...f, marae: marae.name, allowed };
        maraeFindings.push(finding);
        allFindings.push(finding);
        if (allowed) allowedCount.n += 1;
        else driftCount += 1;
      }
    }
    report.maraes[marae.name] = { findingCount: maraeFindings.length };
  }

  // ── PRINT SUMMARY TABLE, GROUPED BY CATEGORY ──
  console.log(`\n\n=== Drift summary (grouped by category) ===\n`);
  const byCategory = {};
  for (const f of allFindings) (byCategory[f.category] = byCategory[f.category] || []).push(f);

  if (Object.keys(byCategory).length === 0) {
    console.log('No differences found in any checked category. All maraes match the reference.\n');
  }

  for (const category of Object.keys(byCategory).sort()) {
    console.log(`## ${category}`);
    const rows = byCategory[category].map((f) => ({
      item: truncate(f.item, 50),
      marae: f.marae,
      status: f.allowed ? `${f.status} (allowed)` : f.status,
      reference: truncate(f.refValue, 40),
      maraeValue: truncate(f.maraeValue, 40),
    }));
    console.log(
      formatTable(rows, [
        { key: 'item', label: 'Item' },
        { key: 'marae', label: 'Marae' },
        { key: 'status', label: 'Status' },
        { key: 'reference', label: 'Reference' },
        { key: 'maraeValue', label: 'Marae value' },
      ])
    );
    console.log('');
  }

  // ── COULD-NOT-CHECK SECTION ──
  console.log(`=== Could not check ===\n`);
  let anyCouldNotCheck = false;
  for (const [projectName, entries] of Object.entries(report.couldNotCheck)) {
    for (const e of entries) {
      anyCouldNotCheck = true;
      console.log(`- [${projectName}] ${e.category}: ${e.reason}`);
    }
  }
  if (!anyCouldNotCheck) console.log('(none -- every category was readable on every project)');

  // ── ALLOWED DIFFERENCES (for visibility, not counted as drift) ──
  const allowedFindings = allFindings.filter((f) => f.allowed);
  if (allowedFindings.length > 0) {
    console.log(`\n=== Allowed differences (from allowlist.json, not counted as drift) ===\n`);
    for (const f of allowedFindings) {
      const entry = allowlist.entries.find(
        (e) => e.category === f.category && e.item === f.item && (e.marae === f.marae || e.marae === '*')
      );
      console.log(`- [${f.marae}] ${f.category}: ${f.item} -- ${entry ? entry.reason : '(no reason on file)'}`);
    }
  }

  // ── WRITE JSON REPORT ──
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `drift-report-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
  report.findings = allFindings;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull JSON report written to: ${path.relative(process.cwd(), reportPath)}`);

  if (args.json) {
    console.log('\n--- JSON report ---');
    console.log(JSON.stringify(report, null, 2));
  }

  console.log(
    `\n=== Result: ${driftCount} drift finding(s), ${allowedCount.n} allowed difference(s), ${
      anyCouldNotCheck ? Object.values(report.couldNotCheck).reduce((n, arr) => n + arr.length, 0) : 0
    } category/project combo(s) could not be checked ===\n`
  );

  process.exit(driftCount > 0 ? 1 : 0);
}

main();
