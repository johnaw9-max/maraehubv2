select 'close_linked_task_exists' as check_name,
  exists(select 1 from pg_proc where proname = 'close_linked_task') as result
union all
select 'close_linked_task_is_security_definer',
  coalesce((select prosecdef from pg_proc where proname = 'close_linked_task'), false)
union all
select 'close_linked_task_search_path_pinned',
  coalesce((
    select proconfig @> array['search_path=public']
    from pg_proc where proname = 'close_linked_task'
  ), false)
union all
select 'close_linked_task_not_public_executable',
  not has_function_privilege('public', 'public.close_linked_task(uuid)', 'execute')
union all
select 'close_linked_task_not_authenticated_executable',
  not has_function_privilege('authenticated', 'public.close_linked_task(uuid)', 'execute')
union all
select 'close_linked_task_service_role_executable',
  has_function_privilege('service_role', 'public.close_linked_task(uuid)', 'execute')
union all
select 'redeem_action_reminder_token_calls_close_linked_task',
  pg_get_functiondef('public.redeem_action_reminder_token(uuid)'::regprocedure) like '%close_linked_task%'
union all
select 'redeem_action_reminder_token_still_security_definer',
  coalesce((select prosecdef from pg_proc where proname = 'redeem_action_reminder_token'), false)
union all
select 'redeem_action_reminder_token_still_service_role_only',
  not has_function_privilege('authenticated', 'public.redeem_action_reminder_token(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.redeem_action_reminder_token(uuid)', 'execute');
