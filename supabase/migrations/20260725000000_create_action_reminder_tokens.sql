-- One-tap "mark as done" links for overdue meeting-action reminder emails
-- (ClickUp 86d3tjb94). Single-use, expiring, trustee-only tokens — no login
-- required to click the link, but the token itself is the entire security
-- boundary, so every write path goes through a SECURITY DEFINER function
-- rather than raw table access, and both functions are locked down to
-- service_role only (see grants at the bottom).

create table if not exists action_reminder_tokens (
  id                 uuid        primary key default gen_random_uuid(),
  meeting_action_id  uuid        not null references meeting_actions(id) on delete cascade,
  trustee_id         uuid        not null references profiles(id) on delete cascade,
  resolved_name      text        not null,
  resolved_email     text        not null,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default (now() + interval '14 days'),
  used_at            timestamptz
);

create index if not exists idx_action_reminder_tokens_meeting_action_id
  on action_reminder_tokens (meeting_action_id);

alter table action_reminder_tokens enable row level security;
-- Deliberately no policies for authenticated/anon — this table is never read
-- or written by a normal app session, only by the two functions below,
-- called from edge functions running under the service role key.


-- ── issue_action_reminder_token ────────────────────────────────────────────
-- Called once per overdue-action reminder email, from check-deadlines.
-- Invalidates any still-live token for the same action before issuing a new
-- one, so at most one link is ever live per action at a time. Both writes
-- run as a single statement/transaction inside this function body.

create or replace function issue_action_reminder_token(
  p_meeting_action_id uuid,
  p_trustee_id        uuid,
  p_resolved_name     text,
  p_resolved_email    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_id uuid;
begin
  update action_reminder_tokens
  set used_at = now()
  where meeting_action_id = p_meeting_action_id
    and used_at is null
    and expires_at > now();

  insert into action_reminder_tokens
    (meeting_action_id, trustee_id, resolved_name, resolved_email)
  values
    (p_meeting_action_id, p_trustee_id, p_resolved_name, p_resolved_email)
  returning id into v_token_id;

  return v_token_id;
end;
$$;


-- ── redeem_action_reminder_token ───────────────────────────────────────────
-- Called from mark-action-done on the confirm page's POST. The UPDATE ...
-- WHERE used_at IS NULL ... is the actual single-use enforcement: Postgres's
-- row lock on that UPDATE serializes concurrent redemption attempts, so a
-- double-click or a duplicate request can only ever succeed once. Returns an
-- empty row set for any invalid/expired/already-used token — the caller
-- distinguishes success from failure purely by row count, not by inspecting
-- token state separately (that would reintroduce the check-then-write race
-- this function exists to avoid).
--
-- status IS DISTINCT FROM 'Completed' (not !=) because meeting_actions.status
-- is nullable live despite schema.sql declaring it NOT NULL DEFAULT 'Open'
-- (discrepancy found 2026-07-25, see ClickUp 86d3u2dvr) — a plain != would
-- silently fail to match a NULL-status row and the update would no-op.

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

  return query
    select ma.id, ma.description
    from meeting_actions ma
    where ma.id = v_action_id;
end;
$$;


-- ── Grants ──────────────────────────────────────────────────────────────────
-- Both functions are SECURITY DEFINER, so without this they'd be callable by
-- any logged-in user via .rpc() from their own session — revoke the default
-- PUBLIC execute grant and restrict to service_role only, matching the two
-- edge functions (check-deadlines, mark-action-done) that are their only
-- legitimate callers.

revoke execute on function issue_action_reminder_token(uuid, uuid, text, text) from public, anon, authenticated;
grant  execute on function issue_action_reminder_token(uuid, uuid, text, text) to service_role;

revoke execute on function redeem_action_reminder_token(uuid) from public, anon, authenticated;
grant  execute on function redeem_action_reminder_token(uuid) to service_role;
