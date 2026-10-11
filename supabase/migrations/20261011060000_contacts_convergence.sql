-- Idempotent convergence (14yhc7kw7b2 Stage 2): contacts.created_at /
-- contacts.role type+nullability, drop the redundant "Authenticated users
-- can manage contacts" policy where "allow_authenticated" already covers
-- it, and drop update_last_sign_in only where no trigger still uses it.
--
-- Every change is independently guarded so this file is safe to run on a
-- project that is already converged and safe to run twice. In particular
-- the policy and function drops must NOT fire everywhere: on a project
-- without an "allow_authenticated" policy, the older policy is the only
-- thing granting contacts access, and on a project where a trigger still
-- calls update_last_sign_in, dropping the function would break that trigger.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'contacts' and column_name = 'created_at'
      and data_type <> 'timestamp without time zone'
  ) then
    alter table contacts alter column created_at type timestamp without time zone;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'contacts' and column_name = 'role' and is_nullable = 'NO'
  ) then
    alter table contacts alter column role drop not null;
  end if;

  if exists (
    select 1 from pg_policies where tablename = 'contacts' and policyname = 'allow_authenticated'
  ) and exists (
    select 1 from pg_policies where tablename = 'contacts' and policyname = 'Authenticated users can manage contacts'
  ) then
    drop policy "Authenticated users can manage contacts" on contacts;
  end if;

  if exists (
    select 1 from pg_proc where proname = 'update_last_sign_in'
  ) and not exists (
    select 1 from pg_trigger t
    join pg_proc p on t.tgfoid = p.oid
    where p.proname = 'update_last_sign_in'
  ) then
    drop function update_last_sign_in();
  end if;
end $$;
