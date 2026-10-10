select 'documents_old_public_all_policy_gone' as check_name,
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Allow all uploads'
  ) as result

union all
select 'documents_old_public_insert_policy_gone',
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('Allow inserts', 'Allow uploads')
  )

union all
select 'documents_old_public_delete_policy_gone',
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Allow deletes'
  )

union all
select 'documents_insert_authenticated_only',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'INSERT' and qual is null and with_check ilike '%documents%'
      and roles = '{authenticated}'
  )

union all
select 'documents_update_authenticated_only',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'UPDATE' and qual ilike '%documents%'
      and roles = '{authenticated}'
  )

union all
select 'documents_delete_authenticated_only',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'DELETE' and qual ilike '%documents%'
      and roles = '{authenticated}'
  )

union all
select 'documents_read_still_public',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Allow reads' and cmd = 'SELECT'
      and roles = '{public}'
  )

union all
select 'no_public_write_policy_remains_on_documents',
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles = '{public}'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (qual ilike '%documents%' or with_check ilike '%documents%')
  );
