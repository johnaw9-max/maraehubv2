-- Urgent fix, found while researching Stage 3's design (ClickUp 86d3u7790):
-- Tineka's profiles table had an extra policy, "Allow anon to read
-- profiles" (SELECT, qual: true, granted to anon), on top of its normal
-- authenticated-only policy. Confirmed genuinely exploitable: an
-- unauthenticated request against /rest/v1/profiles returned all 8 rows
-- (HTTP 200, content-range 0-7/8) before this fix. Opeke has no equivalent
-- policy and was confirmed not exploitable the same way (0 rows returned
-- to an anon request there).
--
-- Tineka is test/staging, but genuinely holds real people's data in
-- profiles (at minimum johnaw9@gmail.com and a real prior trustee's
-- record, handled carefully earlier this session) -- this exposed real
-- names, emails, and roles to anyone, no authentication required.
--
-- No legitimate feature in this codebase depends on anonymous profile
-- reads. Idempotent / safe to re-run.

drop policy if exists "Allow anon to read profiles" on public.profiles;
