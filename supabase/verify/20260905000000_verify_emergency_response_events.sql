select 'emergency_response_events_table_exists' as check_name,
  exists(select 1 from information_schema.tables where table_name = 'emergency_response_events') as result

union all
select 'emergency_response_events_rls_enabled',
  exists(select 1 from pg_tables where tablename = 'emergency_response_events' and rowsecurity = true)

union all
select 'emergency_response_events_policy_is_trustee_gated',
  exists(
    select 1 from pg_policies
    where tablename = 'emergency_response_events'
      and policyname = 'Trustees can manage emergency response events within their entities'
      and qual like '%role = ''trustee''%'
  )

union all
select 'emergency_response_events_people_served_check_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'emergency_response_events' and constraint_name = 'emergency_response_events_people_served_check'
  )

union all
select 'emergency_response_evidence_bucket_exists',
  exists(select 1 from storage.buckets where id = 'emergency-response-evidence')

union all
select 'emergency_response_evidence_bucket_is_public',
  coalesce((select public from storage.buckets where id = 'emergency-response-evidence'), false)

union all
select 'emergency_response_evidence_upload_policy_exists',
  exists(
    select 1 from pg_policies
    where tablename = 'objects' and schemaname = 'storage'
      and policyname = 'emergency-response-evidence: allow all uploads'
  )

union all
select 'no_real_events_recorded_yet',
  (select count(*) from emergency_response_events) = 0;
