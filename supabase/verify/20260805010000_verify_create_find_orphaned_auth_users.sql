select 'find_orphaned_auth_users_exists' as check_name,
  exists(select 1 from pg_proc where proname = 'find_orphaned_auth_users') as result
union all
select 'find_orphaned_auth_users_is_security_definer',
  coalesce((select prosecdef from pg_proc where proname = 'find_orphaned_auth_users'), false)
union all
select 'find_orphaned_auth_users_search_path_pinned',
  coalesce((
    select proconfig @> array['search_path=public']
    from pg_proc where proname = 'find_orphaned_auth_users'
  ), false)
union all
select 'find_orphaned_auth_users_not_public_executable',
  not has_function_privilege('public', 'public.find_orphaned_auth_users()', 'execute')
union all
select 'find_orphaned_auth_users_service_role_executable',
  has_function_privilege('service_role', 'public.find_orphaned_auth_users()', 'execute');
