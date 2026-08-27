-- Fixes a real chain break found during the Automation Engine discovery audit
-- (ClickUp 86d45fub4): redeem_action_reminder_token() -- the "mark as done"
-- email link a trustee gets in the overdue-action reminder -- sets
-- meeting_actions.status = 'Completed' but never closes the linked Task
-- Board card. Every other "mark done" path (ComplianceTracker.js,
-- CommitteeMinutes.js's own edit form) calls closeLinkedTask() in
-- src/lib/taskSync.js for exactly this reason; this SQL function was the one
-- path that couldn't, since it's a SECURITY DEFINER Postgres function called
-- from an edge function, not JS, and can't import taskSync.js.

-- ── close_linked_task ────────────────────────────────────────────────────
-- Direct SQL equivalent of closeLinkedTask() in src/lib/taskSync.js -- same
-- matching (tasks.description LIKE '%[source_id:<id>]%'), same target
-- statuses, same completed_at stamp. Generic on purpose (takes any source
-- id, not meeting-action-specific) so it can be reused by a future SQL
-- caller the same way the JS version already is by multiple JS callers.
--
-- p_source_id is a uuid resolved from the database itself (never raw user
-- input) and UUIDs contain no '%'/'_' characters, so concatenating it into
-- the LIKE pattern needs no escaping.

create or replace function close_linked_task(p_source_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update tasks
  set status = 'completed', completed_at = now()
  where description like '%[source_id:' || p_source_id || ']%'
    and status in ('open', 'in-progress');
end;
$$;

revoke execute on function close_linked_task(uuid) from public, anon, authenticated;
grant  execute on function close_linked_task(uuid) to service_role;


-- ── redeem_action_reminder_token ─────────────────────────────────────────
-- Same function as 20260725000000_create_action_reminder_tokens.sql, with
-- one addition: closes the linked task after marking the action Completed.
-- Everything else (single-use enforcement via the UPDATE ... WHERE
-- used_at IS NULL row lock, the status IS DISTINCT FROM 'Completed' check
-- for the known-nullable-status discrepancy) is unchanged from that
-- original definition.
--
-- Known limitation, not fixed here: an ACTION: task created via the still-
-- separate raw-insert path in CommitteeMinutes.js's saveAction() (as
-- opposed to createOverdueTasks()'s ensureTask() path) has no
-- [source_id:] marker and so won't be found by close_linked_task either --
-- that's a separate fix (unifying the two task-creation paths), tracked
-- as its own step in 86d45fub4, deliberately not bundled into this one.

create or replace function redeem_action_reminder_token(p_token uuid)
returns table(meeting_action_id uuid, description text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_id uuid;
begin
  update action_reminder_tokens
  set used_at = now()
  where id = p_token
    and used_at is null
    and expires_at > now()
  returning action_reminder_tokens.meeting_action_id into v_action_id;

  if v_action_id is null then
    return;
  end if;

  update meeting_actions
  set status = 'Completed'
  where id = v_action_id
    and status is distinct from 'Completed';

  perform close_linked_task(v_action_id);

  return query
    select ma.id, ma.description
    from meeting_actions ma
    where ma.id = v_action_id;
end;
$$;

revoke execute on function redeem_action_reminder_token(uuid) from public, anon, authenticated;
grant  execute on function redeem_action_reminder_token(uuid) to service_role;
