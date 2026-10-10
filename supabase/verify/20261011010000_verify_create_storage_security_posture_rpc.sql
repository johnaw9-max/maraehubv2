select 'get_storage_security_posture_function_exists' as check_name,
  exists(select 1 from pg_proc where proname = 'get_storage_security_posture') as result

union all
select 'get_storage_security_posture_locked_to_service_role',
  not exists(
    select 1 from information_schema.routine_privileges
    where routine_name = 'get_storage_security_posture'
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  )

union all
select 'get_storage_security_posture_returns_policy_rows',
  exists(select 1 from get_storage_security_posture() where kind = 'policy')

union all
select 'get_storage_security_posture_returns_bucket_rows',
  exists(select 1 from get_storage_security_posture() where kind = 'bucket');
