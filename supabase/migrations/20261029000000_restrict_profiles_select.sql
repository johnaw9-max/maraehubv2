-- Privacy fix: profiles table readable/writable by any logged-in
-- account. Approved by John Williams, 2026-10-29 (investigation +
-- SELECT proposal), write-side scope approved same day. APPLYING TO
-- TEST PROJECT ONLY (zfefukxaliuximizjkwa / Tineka) — not pushed to
-- Terere or Opeke yet.
--
-- Live investigation (2026-10-29) found the real policy is broader than
-- the original ticket described: "profiles: authenticated full access"
-- is cmd = ALL (select+insert+update+delete), using(true)/
-- with_check(true), to authenticated. This migration replaces it with:
--   SELECT   — own row always; a trustee may read EVERY profile in
--              their marae (not just other trustees — John asked for
--              this specifically so BookingsManager's approve/decline
--              notification email, which looks up a COMMUNITY member's
--              row, keeps working).
--   INSERT   — trustees only (nothing in the codebase ever inserts a
--              profile row as a community account — signup creates the
--              row via handle_new_auth_user, a SECURITY DEFINER
--              trigger on auth.users, which bypasses this policy
--              entirely regardless).
--   UPDATE   — own row or a trustee's row-level access to any row
--              (ContactsManager.js/MaraeSettings.js, both trustee-only
--              screens, update OTHER people's rows); a BEFORE UPDATE
--              trigger (below) separately blocks anyone — trustee or
--              not — from changing their OWN role/trustee_role, which
--              is the specific write hole John asked to close. Contact
--              fields (full_name, email, phone, notes, iwi) stay
--              self-editable, matching "people can still edit their
--              own name and contact details."
--   DELETE   — no policy at all, i.e. denied outright for every
--              authenticated account. Grepped the whole codebase: no
--              client-side code ever deletes a profiles row (ban-
--              trustee's deletion, if any, runs on service_role and
--              bypasses RLS regardless). Same "denies outright, not
--              guessed as safe" pattern already used for login_attempts
--              and export_log (20260911020000 / 20260911030000).
--
-- Two deliberate ADDITIONS beyond what was explicitly asked, flagged
-- here and in the report rather than silently assumed: (1) INSERT and
-- non-self UPDATE now both require is_trustee() — today ANY
-- authenticated account, including community, can write ANY profile
-- row; this closes that the same way SELECT was closed, since no
-- legitimate flow needs a community account to write someone else's
-- row. (2) the self-escalation block applies to role AND trustee_role
-- for EVERY trustee, not just admins — matches ContactsManager.js's
-- handleUpdateRole/handleSaveUser, which today has no admin gate at
-- all (any trustee can already change ANY OTHER trustee's role via
-- that screen) — this migration does not add an admin-only gate on
-- top of that existing behaviour, only blocks touching one's OWN row.
-- If "only an admin may change someone ELSE's role/trustee_role" is
-- also wanted, that is a one-line addition to the trigger below, not
-- yet made — flagged in the report as a separate decision, not
-- assumed.
--
-- is_entity_member() (SECURITY INVOKER, used by entity-isolation RLS on
-- other tables) only ever looks up `profiles where id = auth.uid()` —
-- the caller's own row — so it keeps working under the new "own row
-- always readable" policy without any change.
--
-- is_trustee() mirrors is_founder()'s naming (20260926000000) but,
-- unlike is_founder(), must be SECURITY DEFINER: founder status is a
-- hardcoded email checked straight off the JWT, but trustee status is
-- a real column on profiles, and a non-definer lookup here would
-- re-enter profiles' own SELECT policy while evaluating it. Scoped to
-- a boolean existence check only, no row data returned, so the
-- elevated privilege cannot itself leak anything.
create or replace function public.is_trustee()
returns boolean
security definer
set search_path = public
language sql
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'trustee'
  );
$$;

drop policy if exists "profiles: authenticated full access" on public.profiles;

create policy "profiles: read own row"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: trustees read every profile in their marae"
  on public.profiles for select
  to authenticated
  using (public.is_trustee());

create policy "profiles: trustees can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.is_trustee());

create policy "profiles: own row or trustee can update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_trustee())
  with check (id = auth.uid() or public.is_trustee());

-- No INSERT/UPDATE policy change can express "same row, but this one
-- column is off-limits" — RLS is row-level. A BEFORE UPDATE trigger is
-- the standard way to add a column-level rule on top of row-level RLS.
-- Reads OLD/NEW directly (always visible to a trigger regardless of
-- the caller's own RLS visibility), so this does not need to be
-- SECURITY DEFINER.
create or replace function public.profiles_protect_permission_fields()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.trustee_role is distinct from old.trustee_role)
     and auth.uid() = old.id then
    raise exception 'You cannot change your own role or trustee_role.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_permission_fields on public.profiles;

create trigger protect_profiles_permission_fields
  before update on public.profiles
  for each row
  execute function public.profiles_protect_permission_fields();

-- Deliberately no DELETE policy — see note above. Denied outright.
