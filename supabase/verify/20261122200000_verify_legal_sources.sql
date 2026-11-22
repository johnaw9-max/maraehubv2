select 'legal_sources_table_exists' as check_name,
  exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'legal_sources') as result
union all
select 'legal_sources_row_level_security_on',
  (select relrowsecurity from pg_class where oid = 'public.legal_sources'::regclass)
union all
select 'legal_sources_select_policy_for_authenticated',
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'legal_sources' and policyname = 'legal_sources_read' and cmd = 'SELECT' and 'authenticated' = any(roles))
union all
select 'legal_sources_has_no_write_policy',
  not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'legal_sources' and cmd <> 'SELECT')
union all
select 'legal_sources_row_count_is_30', (select count(*) from public.legal_sources) = 30
union all
select 'legal_sources_keys_unique_and_present', (select count(distinct key) from public.legal_sources) = 30
union all
select 'legal_sources_every_row_has_status_and_version',
  (select count(*) from public.legal_sources where coalesce(status, '') = '' or coalesce(version_and_date_read, '') = '') = 0
union all
select 'legal_sources_urls_are_https_or_null',
  (select count(*) from public.legal_sources where url is not null and url not like 'https://%') = 0
union all
select 'legal_sources_fenz17_as_at_2_nov_2026',
  exists(select 1 from public.legal_sources where key = 'FENZ17' and version_and_date_read like 'as at 2 Nov 2026%')
union all
select 'legal_sources_trusts_act_reservation_stays_to_verify',
  exists(select 1 from public.legal_sources where key = 'TA19' and status like '%To verify%')
union all
select 'legal_sources_incorporated_society_deadline_passed_noted',
  exists(select 1 from public.legal_sources where key = 'ISA22' and notes like '%5 Apr 2026 has passed%')
union all
select 'legal_sources_new_keys_present',
  (select count(*) from public.legal_sources where key in ('FENZOB','FENZES','FENZMX','MOJMLT','COREG','COISR','TAMAR')) = 7;
