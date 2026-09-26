-- Real founder-only RLS, replacing the client-side-only FOUNDER_EMAILS
-- gate. Investigation (2026-09-26) found founder_notes, feedback, and
-- marae_settings.founder_metrics all had `using (true) to authenticated`
-- policies -- any logged-in user (any trustee, or any community-portal
-- account, since Supabase's `authenticated` Postgres role applies to
-- every logged-in user regardless of profiles.role) could read/write this
-- founder-only data directly via the Supabase REST API, bypassing the
-- FounderDashboard.js UI gate entirely. Root cause: RLS is row-level, the
-- old policies granted blanket row access, and hiding a nav link is not
-- access control.
--
-- is_founder() mirrors the FOUNDER_EMAILS array already hardcoded in
-- App.js/NavSidebar.js/Header.js/FounderDashboard.js -- this becomes the
-- 5th place that list lives, kept in sync manually like everything else
-- in this project. Not security definer: it only ever reads the caller's
-- own JWT claim, no elevated privilege needed.
create or replace function is_founder()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = ANY (ARRAY['johnaw9@gmail.com', 'waj@maraehub.co.nz']);
$$;

-- ── FOUNDER_NOTES: full lockdown ────────────────────────────────────────
-- Confirmed via full-codebase grep: nothing outside FounderDashboard.js
-- touches this table. Safe to restrict every operation.
drop policy if exists "founder_notes: authenticated access" on founder_notes;

create policy "founder_notes: founder only"
  on founder_notes for all
  to authenticated
  using (is_founder())
  with check (is_founder());

-- ── FEEDBACK: split by operation, not a blanket lockdown ────────────────
-- FeedbackButton.js and UxPulsePrompt.js only ever .insert(...) and never
-- chain .select() to read the row back, so submission still works with
-- read access removed. Only FounderDashboard.js reads or resolves
-- feedback; nothing in the codebase deletes a feedback row.
drop policy if exists "allow_authenticated" on feedback;

create policy "feedback: anyone can submit"
  on feedback for insert
  to authenticated
  with check (true);

create policy "feedback: founder can read"
  on feedback for select
  to authenticated
  using (is_founder());

create policy "feedback: founder can resolve"
  on feedback for update
  to authenticated
  using (is_founder())
  with check (is_founder());

create policy "feedback: founder can delete"
  on feedback for delete
  to authenticated
  using (is_founder());

-- ── FOUNDER_METRICS: extracted out of marae_settings ────────────────────
-- marae_settings is a shared, single-row-per-project settings table used
-- throughout the app (bookings, compliance, grants AI drafting context,
-- etc.) -- RLS is row-level, not column-level, so founder_metrics could
-- not be locked down while it lived inside that row without breaking
-- every other legitimate use of marae_settings. Confirmed via grep:
-- founder_metrics is touched exclusively by FounderDashboard.js, so
-- extracting it is safe. Singleton table, matching marae_settings' own
-- existing singleton convention (no entity_id, one row per project).
create table if not exists founder_metrics (
  id uuid not null default gen_random_uuid(),
  data jsonb,
  updated_at timestamp with time zone default now()
);

alter table founder_metrics add constraint founder_metrics_pkey PRIMARY KEY (id);

alter table founder_metrics enable row level security;

create policy "founder_metrics: founder only"
  on founder_metrics for all
  to authenticated
  using (is_founder())
  with check (is_founder());

insert into founder_metrics (data)
select founder_metrics from marae_settings where founder_metrics is not null;

alter table marae_settings drop column if exists founder_metrics;
