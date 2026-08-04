select 'risk_register_trustee_id_exists' as check_name,
  exists(select 1 from information_schema.columns where table_name='risk_register' and column_name='trustee_id') as result
union all
select 'risk_register_trustee_id_fk_correct',
  exists(select 1 from pg_constraint where conrelid='public.risk_register'::regclass and pg_get_constraintdef(oid) like '%trustee_id%auth.users%')
union all
select 'booking_feedback_user_id_exists',
  exists(select 1 from information_schema.columns where table_name='booking_feedback' and column_name='user_id')
union all
select 'booking_feedback_user_id_fk_correct',
  exists(select 1 from pg_constraint where conrelid='public.booking_feedback'::regclass and pg_get_constraintdef(oid) like '%user_id%auth.users%ON DELETE SET NULL%');
