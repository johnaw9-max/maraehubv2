select 'lim25_shows_version_25' as check_name,
  coalesce((select version_and_date_read from public.legal_sources where key = 'LIM25'), '') like 'version 25.0 as at 1 Oct 2026%' as result
union all
select 'lim25_still_has_no_guessed_link',
  coalesce((select url from public.legal_sources where key = 'LIM25'), '') = ''
union all
select 'still_thirty_sources',
  (select count(*) from public.legal_sources) = 30;
