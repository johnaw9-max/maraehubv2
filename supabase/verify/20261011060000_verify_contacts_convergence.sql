select 'contacts_created_at_without_tz' as check_name,
  (select data_type from information_schema.columns
   where table_name = 'contacts' and column_name = 'created_at') = 'timestamp without time zone' as result

union all
select 'contacts_role_nullable',
  (select is_nullable from information_schema.columns
   where table_name = 'contacts' and column_name = 'role') = 'YES'

union all
select 'no_redundant_policy_when_allow_authenticated_exists',
  not exists (select 1 from pg_policies where tablename = 'contacts' and policyname = 'allow_authenticated')
  or not exists (select 1 from pg_policies where tablename = 'contacts' and policyname = 'Authenticated users can manage contacts')

union all
select 'update_last_sign_in_not_orphaned',
  not exists (select 1 from pg_proc where proname = 'update_last_sign_in')
  or exists (
    select 1 from pg_trigger t
    join pg_proc p on t.tgfoid = p.oid
    where p.proname = 'update_last_sign_in'
  );
