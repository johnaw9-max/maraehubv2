-- Real, app-layer failed-login tracking (14yhc7kpfz3 Step 2).
--
-- Why this exists instead of Supabase Auth's own audit log: investigated
-- and ruled out first. auth.audit_log_entries stayed empty on both real
-- projects across 5 separate real login attempts (failed and successful),
-- even after genuinely enabling `audit_log_disable_postgres = false` via
-- the Dashboard (confirmed persisted) and restarting the project
-- afterward. The Management API's own PATCH for that same setting is a
-- silent no-op -- returns 200, never actually changes the value. Not a
-- foundation to build a security check on; tracking it ourselves instead.
--
-- Real, honest coverage note: only src/pages/LoginPage.js's password-login
-- form writes here. It does not see attempts against the Supabase Auth API
-- made directly (bypassing the app UI), nor the separate community
-- magic-link path (community-auto-login, already gated by its own secret
-- token, not password-guessable). This is a first-layer check for the
-- common case -- a naive automated attack against the visible login form
-- -- not a defense against a targeted attacker who already knows to go
-- around it.
--
-- No ip_address column: a client-side insert has no way to know the
-- caller's real IP that isn't trivially spoofable from the browser itself.
-- Would need a server-side relay to add honestly; out of scope here.
create table if not exists login_attempts (
  id uuid not null default gen_random_uuid(),
  email text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

alter table login_attempts add constraint login_attempts_pkey PRIMARY KEY (id);

-- Read/write for the detection check and pruning; not used for filtering
-- login attempts by time in this migration, but a real, common query shape
-- for both, so indexed now rather than discovered as a gap later.
create index if not exists login_attempts_email_attempted_at_idx
  on login_attempts (email, attempted_at);

alter table login_attempts enable row level security;

-- Insert-only for anon/authenticated -- a login attempt happens before any
-- session exists, so the client is on the anon key at that point; allowing
-- authenticated too covers the (harmless, unlikely) case of an
-- already-signed-in session hitting the form again. No select/update/delete
-- policy for either role is defined at all, which correctly denies those
-- outright under RLS -- this table's contents (real emails + a timing
-- signal of who's struggling to log in) are more sensitive than most, so
-- it starts locked down rather than getting locked down later, same
-- lesson as get_trustee_login_activity()'s real PII incident (86d40pp1u).
-- service_role (used by check-deadlines) bypasses RLS entirely, no policy
-- needed for it to read or prune.
create policy "login_attempts: anon and authenticated can insert"
  on login_attempts for insert
  to anon, authenticated
  with check (true);
