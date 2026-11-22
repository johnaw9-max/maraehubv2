select 'source_keys_column_exists' as check_name,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'compliance_items' and column_name = 'source_keys') = 1 as result
union all
select 'every_source_key_is_in_legal_sources',
  not exists (select 1 from public.compliance_items i, unnest(i.source_keys) k where k not in (select key from public.legal_sources))
union all
select 'no_duplicate_keys_on_an_item',
  not exists (select 1 from public.compliance_items i where cardinality(i.source_keys) <> (select count(distinct k) from unnest(i.source_keys) k))
union all
select 'keyed_items_are_a_subset_of_items',
  (select count(*) from public.compliance_items where cardinality(source_keys) > 0) <= (select count(*) from public.compliance_items);
