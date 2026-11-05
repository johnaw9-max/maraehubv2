# Phase 1 – Security and Trust Remediation: release guide

Nothing in this folder has been applied to any project. Nothing on the
`phase1/security-remediation` branch has been deployed. Every step below
needs John's approval, and each one goes to the **test project first**
(zfefukxaliuximizjkwa), then Terere, then Ōpeke, one at a time, at a quiet time.

## Why the order matters

The website change is written to work with both the old and the new
functions. The new functions do **not** work with the old website: the old
website sends the public key to `notify-hirer` and does not send the AI
confirmation to `draft-minutes`. So the website goes first.

| Step | What | Interrupts anything? | Rollback |
|---|---|---|---|
| 1 | Merge the PR (Vercel deploys the website) | No. Works with the old functions: emails, file links and AI drafting behave as today, plus the AI notice and tick box. | Revert the merge commit |
| 2 | Test project: apply `P1-01_notification_send_log.sql` and `P1-09_ai_drafting_setting.sql` | No. Both functions run without these. | Matching `_rollback.sql` |
| 3 | Test project: deploy `check-deadlines` **before or with** `send-notification` | If `send-notification` goes first, daily admin alerts stop until `check-deadlines` is deployed | Redeploy the previous version from `main@8420d9f` |
| 4 | Test project: deploy `notify-hirer`, `draft-minutes` | Booking/action emails from browser tabs opened **before step 1** fail until refreshed | Redeploy the previous version |
| 5 | Run the live checks in "Tests on the test project" below | – | – |
| 6 | Repeat 2–5 for Terere, then Ōpeke | – | – |
| 7 | Iwi Hub project only: deploy `iwi-pull-snapshot`, then rotate any marae key ever pasted into it | Iwi Hub snapshot pulls stop (no marae feature uses them) | Not recommended |
| 8 | After D-04 approval: `P1-02_private_file_buckets.sql` | Old file addresses stop opening outside the app (by design). Printed evidence links last 1 hour. | `P1-02_private_file_buckets_rollback.sql` (one step) |
| 9 | After the live RLS check confirms it: `P1-07a_marae_settings_trustee_write.sql` | No; community members never edit settings in the app | Matching `_rollback.sql` |

To apply a proposed migration: copy it into `supabase/migrations/` with a new
timestamp name, run the repo's normal migration process (test project first),
then regenerate the expected-migrations/schema files used by the daily check.

## Tests already run (no project touched)

- `scripts/phase1-tests/*.ts` (26 tests): the real function code runs against a
  fake database and fake email/AI services.
  `deno test --no-check --allow-env --allow-read --import-map=scripts/phase1-tests/import_map.json scripts/phase1-tests/`
- `scripts/phase1-tests/sql/run.sh` (15 checks): every proposed migration and
  rollback is applied twice to a throwaway local PostgreSQL that imitates the
  Supabase roles and storage tables, then checked against trustee, community and
  anonymous users.
- App suite: `CI=true npx react-scripts test --watchAll=false` (34 tests), plus a
  strict production build (`CI=true npx react-scripts build`).

## Tests on the test project (before anything is called fixed)

Email (P1-01):
1. `curl` send-notification with no key, then with the anon key: both 401.
2. Trigger check-deadlines (or wait for 08:00 UTC): the admin alert arrives.
3. Stripe test-mode event that forces the fallback path: the admin email arrives.
4. As a trustee: approve a booking, send an invoice, assign a meeting action. All three emails arrive as plain text with line breaks.
5. As a community member: submit a booking. Trustees receive it.
6. Public booking form (no login): trustees receive it.
7. `curl` notify-hirer with a trustee session to an address not in the marae: 403.
8. Resend log: only the expected emails, nothing unexpected.

Files (P1-02 Release 1, then Release 2):
1. Open a document, a compliance file, a receipt and an emergency evidence file. Each opens, and the address bar shows a `/object/sign/` link.
2. Delete a test document: the file is gone from Storage.
3. After Release 2: the old public address returns an error in a private window; files still open in the app; a community account cannot open them.

AI (P1-09):
1. Draft with AI is disabled until the box is ticked; the box clears after each draft.
2. Admin turns AI drafting off: the option disappears for all trustees; a direct call to draft-minutes returns 403.
3. Writing minutes by hand still saves.

Iwi Hub (P1-03): calling iwi-pull-snapshot with any body returns 410.
