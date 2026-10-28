-- Privacy fix: profiles table readable/writable by any logged-in
-- account. Approved by John Williams, 2026-10-29 (investigation +
-- SELECT proposal, write-side scope, then the policy-name fix below).
-- Applied to the test project first; this version is written to also
-- go live on Terere and Opeke once tested.
--
-- Live investigation (2026-10-29) found the real policy is broader than
-- the original ticket described: a single blanket policy, cmd = ALL
-- (select+insert+update+delete), using(true)/with_check(true), to
-- authenticated. Checking ALL THREE live projects (read-only) found
-- this same policy exists under TWO DIFFERENT NAMES depending on
-- project history: "profiles: authenticated full access" on test
-- (zfefukxaliuximizjkwa), and "allow_authenticated" on BOTH Terere
-- (fwtxbirekiyhbxqdctkq) and Opeke (cbeenkpjpnhmtqtnjiyd). The first
-- version of this migration only dropped the test name — run as-is on
-- Terere/Opeke, "drop policy if exists" on a name that does not exist
-- there would have silently no-opped, leaving the real
-- "allow_authenticated" (true) policy live ALONGSIDE the new
-- restrictive ones. Postgres ORs multiple permissive policies
-- together, so the old blanket policy would have won and the fix
-- would have silently done nothing while appearing to succeed. Caught
-- before applying to either project; this version drops both known
-- names explicitly, and ends with a verification step (see bottom of
-- file) that fails the whole migration if any blanket-access policy
-- is still present under any name, known or not.
--
-- This migration replaces that single policy with:
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
begin;

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

-- Both known names for the single pre-existing blanket policy, found
-- by checking all three projects live (see note above). Drop each
-- under its own name; "if exists" makes this safe to run on a project
-- that only has one of the two.
drop policy if exists "profiles: authenticated full access" on public.profiles;
drop policy if exists "allow_authenticated" on public.profiles;

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

-- Final safety gate, run every time this migration runs on any
-- project: fail loudly, and roll back everything above in this same
-- transaction, if any policy on profiles still grants blanket access
-- to every signed-in account. Catches both known pre-existing names
-- (as a redundant check on the drops above) AND any name this
-- investigation did not find — e.g. if a fourth project is ever added
-- with yet another name for the same blanket policy. Checks the
-- literal text 'true', not whether a policy happens to evaluate true
-- for a given caller — none of the policies this migration creates
-- above ever have qual/with_check literally equal to 'true', so this
-- cannot false-positive on its own output.
do $$
declare
  leftover int;
begin
  select count(*) into leftover
  from pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
    and 'authenticated' = any(roles)
    and (qual = 'true' or with_check = 'true');

  if leftover > 0 then
    raise exception
      'profiles RLS migration aborted: % leftover policy(ies) on public.profiles still grant every signed-in account full access (qual or with_check = true). Nothing in this migration was kept.',
      leftover;
  end if;
end;
$$;

commit;
