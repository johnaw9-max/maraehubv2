# Release checklist

No release checklist existed before this file -- it's created here with
the one item this change needs. Add to it as other pre-release steps are
established.

- [ ] Run the drift check before merging to main: `node scripts/drift-check/drift-check.js` (see `scripts/drift-check/README.md`).
- [ ] Run the integrity audit before every release, once per marae: `node scripts/drift-check/integrity-audit.js --marae <name>` for each project in `scripts/marae-registry.json` (currently `terere`, `tineka`, `opeke`). Fix any `FAIL`, or add a reasoned entry to `scripts/drift-check/integrity-allowlist.json` if the difference is genuinely intentional.
- [ ] Run the integrity audit for a new marae as part of onboarding it, once its entry is added to `scripts/marae-registry.json`: `node scripts/drift-check/integrity-audit.js --marae <new-name>`.
