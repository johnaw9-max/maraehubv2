# Setting up a new marae (runbook)

Built 16 Nov 2026 (ClickUp 14yhc7kw7b2). Rules that never bend: nothing is copied from another marae; no marae is named in anything written for another; a key is never printed or typed into chat; stop and ask if a step says ❌.

Run from a clean checkout of `main`, up to date. Each command is safe to run twice.

| # | What | Who | Command |
|---|------|-----|---------|
| 0 | Decide the name (lowercase, e.g. `rangi`) and the marae's website address | John | |
| 1 | Database, shared content, functions (Sydney) | John | `scripts/provision-marae.sh <name>` |
| 2 | Secrets (email, AI; derived addresses) | John | `scripts/provision-secrets.sh <name> --frontend-url https://<site>` (needs `~/.maraehub/shared-secrets.env`, chmod 600; see `scripts/secrets-shared.example.env`) |
| 3 | Restart the project once (Dashboard, Restart project), then the maintenance shield | John | `scripts/provision-shield.sh <name> <ref>` |
| 4 | Scheduled jobs (needs step 3: they use the shield's key) | John | `scripts/provision-cron.sh <name>` |
| 5 | Website project in Vercel, linked to the repo, with the two public settings `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` (the project's legacy anon key, public by design; check its role says `anon` and its ref matches this project; NEVER the service key) | Claude, with John's yes | Vercel tools |
| 6 | Register in `scripts/marae-registry.json` by pull request: ref, name, role `production`, `frontend_project`, and `excluded_functions` for `get-tineka-session`, `iwi-pull-snapshot`, `community-auto-login` (each with a reason) | Claude | pull request |
| 7 | Checks | Claude | `node scripts/drift-check/drift-check.js --only=<name>` and `node scripts/drift-check/integrity-audit.js --marae <name>` |

## Still by hand (not automated yet)
- Cronitor monitor and its `CRONITOR_PING_URL`; the dedicated login-check user (`LOGIN_CHECK_EMAIL` / `LOGIN_CHECK_PASSWORD`), typed only into the dashboard.
- Stripe keys, Google/Xero if that marae uses them (`provision-secrets.sh --with calendar,xero`).
- Backup bucket and keys (`BACKUP_*`), in the same AWS region as the database.
- First administrator and settings row: invite the person in the Supabase dashboard (Authentication > Users > Invite user), then `scripts/provision-first-admin.sh <name> --email <their email> --marae-title "Te Marae o ..."` (promotes them to trustee admin and creates the settings row with the marae's own name; the table's built-in defaults belong to another marae). Entities and the first-run wizard: to be tested in the second rehearsal.
- Custom domain.

## After it is live
- Give the marae's trustees nothing until step 7 passes.
- Time the whole run and write the real figure on ClickUp 14yhc7kw7b2.
- A throwaway rehearsal project is deleted with `scripts/delete-rehearsal-project.sh <ref>` (it refuses live projects).
