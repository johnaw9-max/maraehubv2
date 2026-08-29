select 'find_never_logged_in_trustees_exists' as check_name,
  exists(select 1 from pg_proc where proname = 'find_never_logged_in_trustees') as result
union all
select 'find_never_logged_in_trustees_is_security_definer',
  coalesce((select prosecdef from pg_proc where proname = 'find_never_logged_in_trustees'), false)
union all
select 'find_never_logged_in_trustees_search_path_pinned',
  coalesce((
    select proconfig @> array['search_path=public']
    from pg_proc where proname = 'find_never_logged_in_trustees'
  ), false)
union all
select 'find_never_logged_in_trustees_not_public_executable',
  not has_function_privilege('public', 'public.find_never_logged_in_trustees()', 'execute')
union all
-- Explicit anon/authenticated checks, not just public -- this project has
-- a default-privileges rule that grants both directly on function
-- creation, separate from the PUBLIC pseudo-role (found live shipping
-- this migration; "not public executable" alone would have passed while
-- the function was genuinely anon/authenticated-executable).
select 'find_never_logged_in_trustees_not_anon_executable',
  not has_function_privilege('anon', 'public.find_never_logged_in_trustees()', 'execute')
union all
select 'find_never_logged_in_trustees_not_authenticated_executable',
  not has_function_privilege('authenticated', 'public.find_never_logged_in_trustees()', 'execute')
union all
select 'find_never_logged_in_trustees_service_role_executable',
  has_function_privilege('service_role', 'public.find_never_logged_in_trustees()', 'execute');
