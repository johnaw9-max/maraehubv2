select 'maraehub_public_policy_gone' as check_name,
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Allow all maraehub'
  ) as result

union all
select 'no_public_or_anon_storage_policies_remain',
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles::text[] && array['public','anon']::text[]
  );
