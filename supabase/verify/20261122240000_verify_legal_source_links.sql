select 'six_links_are_secure_web_addresses' as check_name,
  (select count(*) from public.legal_sources where key in ('MRR94','FENZ17','WSOFF','WSVOL','BGBWOF','MLC') and url ~ '^https://[^ ]+$') = 6 as result
union all
select 'no_link_is_a_demo_or_search_page',
  not exists (select 1 from public.legal_sources where url ilike '%demo.legislation%' or url ilike '%google.%')
union all
select 'lim25_has_no_guessed_link',
  coalesce((select url from public.legal_sources where key = 'LIM25'), '') = ''
union all
select 'still_thirty_sources',
  (select count(*) from public.legal_sources) = 30;
