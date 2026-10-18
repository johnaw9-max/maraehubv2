# MaraeHub drift check

Two read-only tools, both catalog/metadata-only, both zero-dependency Node
scripts:

- **`integrity-audit.js`** -- audits ONE marae against **the repo on
  `main`** (migrations, function source, required secrets, hosting). Run
  this one before every release and whenever a new marae is added. See
  [below](#marae-integrity-audit) for details.
- **`drift-check.js`** -- compares every marae's Supabase project against
  the **reference project** (Opeke), catching drift between projects that
  the repo-on-main comparison above wouldn't catch (e.g. two maraes
  disagreeing with each other while both disagree with main in the same
  way). Documented first below.

## `drift-check.js`: project-vs-project drift

Read-only comparison of every marae's Supabase project against the
reference project (Opeke), so database drift is caught before a release
instead of discovered by a trustee clicking a broken button in production.

It is **catalog/metadata only** -- `information_schema`, `pg_catalog`,
`pg_policies`, `cron.job`, and `supabase` CLI list commands. It never reads
a row of real data, never prints a secret value (names only), and never
writes to a database, deploys a function, or touches git.

## What it checks

1. Tables and columns -- names, types, nullability, defaults.
2. Functions/RPCs -- name, arguments, return type, `SECURITY DEFINER`.
3. RLS enabled per table, and policy names/commands/`qual`/`with_check`.
4. Triggers and indexes.
5. Edge Functions -- name, deploy status, `verify_jwt`, code hash.
6. Secret **names** present (never values).
7. Scheduled (`cron.job`) jobs -- name, schedule, active.
8. Applied migrations (see the caveat below).

## Running it

```bash
# requires an already-authenticated supabase CLI (npx supabase login, once)
node scripts/drift-check/drift-check.js

# only check specific maraes (by the "name" field in registry.json)
node scripts/drift-check/drift-check.js --only=terere,test

# also dump the full machine-readable report to stdout
node scripts/drift-check/drift-check.js --json
```

No install step -- it's a zero-dependency Node script. It prints every
`supabase` command and the project ref it targets before running it, then:

- a summary table grouped by category (`same` rows are omitted; you only
  see `missing` / `extra` / `different`),
- a **Could not check** section for anything it couldn't read (a schema
  that doesn't exist on that project, a CLI error, etc.) -- this is always
  printed, even when empty, so a silent gap in coverage can't hide,
- an **Allowed differences** section for anything matched in
  `allowlist.json`, shown for visibility but not counted as drift,
- a full JSON report under `scripts/drift-check/reports/` (gitignored).

**Exit code is non-zero if there is any non-allowlisted drift.** Hook this
into CI or a pre-merge check the same way you'd hook in a test suite.

## Adding a marae

Add one object to `registry.json`:

```json
{ "name": "new-marae", "ref": "<its-project-ref>", "role": "marae" }
```

That's it -- the next run picks it up automatically. No code changes.

## Recording an intentional difference

If a difference is real but expected (a function genuinely scoped to one
marae, a secret genuinely not provisioned yet, etc.), add it to
`allowlist.json` instead of ignoring the output:

```json
{ "category": "edge_function", "item": "xero-financials", "marae": "terere", "reason": "secrets not yet provisioned (14yhc7kw74b)" }
```

`marae` can be `"*"` to apply to every marae. Every entry needs a real,
specific reason -- don't add one to silence a finding you haven't actually
looked at. (`scripts/marae-registry.json`'s `excluded_functions`/
`excluded_jobs` already track a similar, longer-standing list for deploy
tooling -- this file is deliberately separate since "don't deploy this
function here" and "this difference is fine, don't report it as drift"
are different claims, even when the underlying reason overlaps.)

## Known caveats (read before trusting a clean result)

- **Migrations (category 8) compare the tracking table, not live schema.**
  This project has a known history of real schema changes applied via
  direct `db query`/SQL editor that never got recorded in
  `supabase_migrations.schema_migrations` on more than one project. A
  migration showing as "missing" here can mean "genuinely never applied"
  **or** "applied for real, just untracked" -- treat it as a lead to verify
  with a direct schema check, not a confirmed gap. A migration that *is*
  tracked on both sides is a much stronger signal than one that isn't
  tracked on either.
- **Edge Function `version` numbers are not compared.** They're a deploy
  counter that differs naturally by a project's deploy history. A hash of
  the actual downloaded `index.ts` source is compared instead (not the
  platform's own bundle hash -- that changes with build metadata even when
  the source is byte-identical, which produced false "different" findings
  in the first version of this check).
- **`iwi-hub` is architecturally a different product** (not a marae
  trustee-board instance), not just a differently-configured marae. Expect
  a large, mostly-expected diff against Opeke until someone who knows that
  schema curates `allowlist.json` for it -- don't treat a clean run against
  `terere`/`test` as implying the same for `iwi-hub`.
- A clean run proves the *catalog* matches. It does not prove the RLS
  policies actually behave the same for a real user (see the
  `maraehubv2_drift_check` project memory for the RLS-simulation technique
  used to verify that separately when needed) -- this tool is the fast,
  cheap, repeatable first pass, not a replacement for behavioral testing
  when something looks suspicious.

## Marae integrity audit

`integrity-audit.js` audits **one marae at a time** against **the repo on
`main`** -- not against another marae's database. It's the tool to run
before every release and whenever a new marae is onboarded.

```bash
# one marae per invocation, by design
node scripts/drift-check/integrity-audit.js --marae terere
node scripts/drift-check/integrity-audit.js --marae tineka   # "test" project
node scripts/drift-check/integrity-audit.js --marae opeke

# also dump the full machine-readable report to stdout
node scripts/drift-check/integrity-audit.js --marae terere --json
```

Marae names come from `scripts/marae-registry.json` **as committed on
`main`** -- every reference fact (migration list, function source, each
function's own `Deno.env.get()` calls, the registry itself) is read via
`git show main:<path>` / `git ls-tree main`, regardless of which branch is
currently checked out. This means the audit always reflects what's
actually released, not speculative work on a feature branch.

### What it checks

Catalog/metadata reads, `supabase` CLI list/download/advisors/backups
commands, and plain HTTP GET/OPTIONS against the public frontend and
function URLs. Never a row's business data, never a secret value, never a
database write, never a deploy. Every command and the project ref it
targets is printed before it runs.

1. **Migrations** -- applied (tracked) vs the repo's migration files.
   Reports counts; "missing" means untracked in the bookkeeping table, not
   necessarily unapplied (same caveat as `drift-check.js` above).
2. **Edge Functions** -- deployed, `ACTIVE`, and the *downloaded source*
   byte-for-byte equal to the repo's `index.ts` (bundle hash ignored, for
   the same reason described above). Flags a function deployed despite
   being on that marae's exclusion list.
3. **Secrets** -- required secret **names** only (derived automatically
   from each expected function's own `Deno.env.get()` calls), vs. what's
   actually set. Lists missing and unexpected names; values are never
   read.
4. **Scheduled jobs** -- exist, active, last run time and status.
5. **Security** -- RLS enabled on every public table; storage bucket
   public flags and `storage.objects` policies vs. the repo-declared final
   state; no legacy public policy left over.
6. **Accounts** (counts only) -- users without profiles, null role/
   `trustee_role`, standard trustees missing a `trustee_entities` link
   where entities exist.
7. **Data sanity** (counts only) -- orphaned rows, unexpected NULLs,
   duplicate auth emails.
8. **Backups** -- enabled, latest completed backup, PITR on/off.
9. **Advisors** -- Supabase security/performance advisors, grouped by
   severity. Only fails on a SECURITY-category WARN/ERROR finding that
   isn't already in `integrity-allowlist.json` as a known, accepted
   platform-level finding.
10. **Hosting** -- the live frontend bundle (`<frontend_project>.vercel.app`)
    references only this marae's own Supabase project ref (no other
    project's ref leaks in); CORS preflight (`OPTIONS`) for every function
    the frontend actually calls (`supabase.functions.invoke(...)` in
    `src/`), checked against whether that function is expected to be
    deployed on this marae.
11. **Email** -- `RESEND_API_KEY`/`FROM_EMAIL` secret **names** present.
    Actual Resend sending-domain verification lives in Resend's own
    dashboard and can't be read from the Supabase side -- that specific
    sub-check is always "could not check," noted in the evidence text,
    without failing the whole check if the names are present.

Output: a short one-line-per-check `PASS` / `FAIL` / `COULD NOT CHECK`
summary first, then full detail, then a full JSON report under
`scripts/drift-check/reports/` (gitignored) and a full text report written
to `~/Downloads/integrity-audit-<marae>-<timestamp>.txt`. **Exit code is
non-zero if any check is `FAIL`.**

### Adding a marae

Add one object to `scripts/marae-registry.json` on `main` -- `ref`, `name`,
`role`, `frontend_project`, and that marae's `excluded_functions`/
`excluded_jobs` (each with a reason). Required secrets and expected
functions are then derived automatically: nothing in `integrity-audit.js`
itself needs to change.

### `integrity-allowlist.json`: intentional per-marae differences

Separate from `scripts/marae-registry.json`'s `excluded_functions`/
`excluded_jobs` (which controls what *should* be deployed/scheduled),
`integrity-allowlist.json` records findings that are real but expected --
a secret genuinely not needed on one marae, a platform-level advisor
finding present identically everywhere, a known leftover secret. Each
entry needs `category`, `item`, `marae` (a registry name, or `"*"` for
every marae), and a specific `reason` confirmed by direct investigation --
never add one speculatively to silence a finding you haven't looked at.
An allowlisted finding is still computed and still shown in the check's
evidence text (marked "allowlisted"); it just doesn't fail the check.

### Design notes

- **One marae per invocation, by design.** `--marae <name>` is required;
  there's no "run every marae in one process" mode, so a release or
  onboarding checklist runs it once per marae explicitly.
- **Never handles a key or password.** If the `supabase` CLI itself ever
  needs one (e.g. a first-time `npx supabase login`), let it prompt you in
  the terminal -- this script never takes one as an argument or embeds one
  in code.
- **Never prints row content.** Every check is a count, a name, a status,
  or a timestamp -- never an email, a person's name, or a marae record's
  text content.
