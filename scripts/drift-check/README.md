# MaraeHub drift check

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
  counter that differs naturally by a project's deploy history. The code
  hash (`sha256`) is compared instead, since it only changes with the
  actual deployed content.
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
