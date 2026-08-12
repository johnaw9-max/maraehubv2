-- ClickUp 86d3u7790, Stage 3: three SECURITY DEFINER grant decisions,
-- each verified empirically before deciding, not assumed.
--
-- check_cron_job_last_success: no legitimate reason found for anon/
-- authenticated access - locked fully, same explicit-lock pattern as
-- every other RPC this session (revoke from public too, not just the
-- named roles - learned that lesson the hard way earlier tonight).
--
-- get_meeting_entity_id: confirmed via pg_policies that this function is
-- referenced directly inside resolutions/meeting_actions' RLS policies
-- (all 8 SELECT/INSERT/UPDATE/DELETE policies across both tables) -
-- authenticated genuinely needs EXECUTE for real trustee queries against
-- those tables to work under RLS at all. anon has zero legitimate need -
-- no anon-role policy anywhere references either table. Revoking public/
-- anon only; authenticated is deliberately kept.
--
-- handle_new_auth_user and update_last_sign_in are both trigger functions
-- - confirmed empirically (direct call attempt) that Postgres refuses any
-- non-trigger invocation regardless of grants ("trigger functions can
-- only be called as triggers"). Their broad grants are structurally
-- inert. Deliberately left unchanged here - not an oversight.
--
-- Idempotent / safe to re-run.

revoke execute on function public.check_cron_job_last_success(text) from public, anon, authenticated;

revoke execute on function public.get_meeting_entity_id(uuid) from public, anon;
