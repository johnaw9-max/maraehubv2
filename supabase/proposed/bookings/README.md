# Booking improvements (Jason Kurei, Ōpeke, 5 Nov 2026) + community edit/cancel

Nothing in this folder has been applied to Terere or Ōpeke. Everything below was
applied to and tested on the TEST project only (zfefukxaliuximizjkwa), 7 Nov 2026.

## What changes for people
| Request | Change |
|---|---|
| End date follows start date | Choosing a start date fills the end date with it (only if the end date is empty or earlier), so the calendar opens there. Add Booking, community wizard, public form, edit form. |
| New occasions | Hura Kōhatu; "Whānau Gathering" replaces "Whanau Reunion"; "Noho Marae/Noho Wānanga". Old bookings keep their saved text. Nothing in the app depends on the names. |
| Organisation / Group | Optional field on every booking form; shown on the booking card and in the trustee email. |
| Community can edit their bookings | Pending: edit or cancel. Approved and still to come: edit (goes back to pending so trustees approve the change again); to cancel, "Request cancellation" emails the trustees. Declined or finished: read only. Trustees are emailed about every edit or cancellation. |

## Database (one migration each, each with a rollback)
| File | What | Needed by |
|---|---|---|
| B1_bookings_organisation | adds optional `organisation` column | the organisation field (the website only sends it when filled in, so order is not critical) |
| B2_booking_member_rules | replaces the "member has full control of their own booking" policy | community edit/cancel; also closes a hole: a member could approve their own booking or delete an approved one through the API |
| B3_booking_protect_fields | trigger: members cannot change owner, reference, entity or creation time | apply straight after B2 |

Prerequisite: `public.is_trustee()` must be SECURITY DEFINER (original design, migration
20261029000000). On 7 Nov 2026 it was found as SECURITY INVOKER on Ōpeke, Terere and the
test project, which makes the profiles read rule loop forever and stops all logins. Fixed
on all three with `ALTER FUNCTION public.is_trustee() SECURITY DEFINER;`. Cause of the change unknown.

## Release order for a marae (test -> Terere -> Ōpeke, one at a time)
1. Deploy the `public-booking-request` function FIRST (it accepts the new occasion names and keeps accepting "Whanau Reunion"). The new website would otherwise be refused by the old function when someone picks a new occasion on the public form.
2. Apply B1, then B2, then B3 (separately; verify each).
3. Merge the PR (Vercel deploys the website to every marae at once).
Rollback: website via Vercel Instant Rollback; each SQL file has a `_rollback.sql`; redeploy the previous function.

## Tests
- `src/lib/bookingRules.test.js` (19 tests): member rules, validation, date logic, occasions. Full app suite 39/39, strict production build OK.
- Live probes on the test project (rolled back): member sees only own; cannot insert as approved or for someone else; cannot self-approve; edit of approved booking only succeeds when resubmitted as pending; cannot edit declined/others'; cannot give a booking away; cannot delete approved/declined/others'; can delete own pending; cannot change reference/entity/created_at; trustees unaffected; server-side calls unaffected; anonymous sees and inserts nothing.

## Known limits (not changed here)
- A community member's date-clash check can only see their own bookings, because members can only read their own rows. The trustees' approval is the real safeguard.
