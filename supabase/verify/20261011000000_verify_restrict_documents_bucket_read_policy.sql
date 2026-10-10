select 'documents_old_public_read_policy_gone' as check_name,
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('Allow reads', 'documents: public read')
  ) as result

union all
select 'documents_read_authenticated_only',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documents: authenticated read'
      and cmd = 'SELECT' and roles = '{authenticated}'
      and qual ilike '%documents%'
  )

union all
select 'no_public_select_policy_remains_on_documents',
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles = '{public}'
      and cmd in ('SELECT', 'ALL')
      and (qual ilike '%documents%' or with_check ilike '%documents%')
  )

union all
select 'documents_write_policies_still_authenticated',
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and cmd in ('INSERT', 'UPDATE', 'DELETE')
       and roles = '{authenticated}'
       and (qual ilike '%documents%' or with_check ilike '%documents%')
  ) = 3;
