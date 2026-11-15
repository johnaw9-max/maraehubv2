# Baseline (structure only)

`baseline.sql` is the whole database structure of the reference project (Opeke) with **no data**, so a new marae can be built in one step instead of replaying every migration. It is a generated file: do not edit it by hand.

- Make it: `node scripts/generate-baseline-migration.js` (read-only; needs `npx supabase login` done once).
- Check it is current: `node scripts/generate-baseline-migration.js --check` (exit 1 if stale).
- After running it on a new empty project, run `verify-baseline.sql`; every `expected` should equal `actual`.
- `baseline.meta.json` records which migration the baseline represents; later migrations are applied afterwards by `scripts/apply-to-all.sh`.
- The file refuses to run on any project that already has tables, so it cannot touch a live marae.
- Not included on purpose: row data, scheduled jobs (built from templates in a later step), secrets, edge functions.
- Shared content that lives in data-only migrations (for example 20261011050000) must be replayed separately: a later step lists them.
