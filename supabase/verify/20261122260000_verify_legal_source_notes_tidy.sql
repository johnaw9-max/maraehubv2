select 'no_note_says_link_to_add' as check_name,
  not exists (select 1 from public.legal_sources where notes ilike '%link to add%') as result
union all
select 'fenzes_note_is_plain_words',
  coalesce((select notes from public.legal_sources where key = 'FENZES'), '') like 'FENZ''s page says%'
union all
select 'still_thirty_sources',
  (select count(*) from public.legal_sources) = 30;
