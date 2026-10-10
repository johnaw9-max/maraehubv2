select 'documents_bucket_exists_and_public' as check_name,
  exists(
    select 1 from storage.buckets where id = 'documents' and public = true
  ) as result

union all
select 'documents_insert_authenticated_only',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documents: authenticated insert'
      and cmd = 'INSERT' and roles = '{authenticated}'
      and with_check ilike '%documents%'
  )

union all
select 'documents_update_authenticated_only',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documents: authenticated update'
      and cmd = 'UPDATE' and roles = '{authenticated}'
      and qual ilike '%documents%'
  )

union all
select 'documents_delete_authenticated_only',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documents: authenticated delete'
      and cmd = 'DELETE' and roles = '{authenticated}'
      and qual ilike '%documents%'
  )

union all
select 'documents_read_is_public',
  exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documents: public read'
      and cmd = 'SELECT' and roles = '{public}'
      and qual ilike '%documents%'
  )

union all
select 'no_public_write_policy_on_documents',
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles = '{public}'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (qual ilike '%documents%' or with_check ilike '%documents%')
  );
