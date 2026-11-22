select 'not_applicable_columns_exist' as check_name,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'compliance_items'
     and column_name in ('not_applicable_reason', 'not_applicable_by', 'not_applicable_at')) = 3 as result
union all
select 'no_item_marked_not_applicable_by_the_migration',
  (select count(*) from public.compliance_items where not_applicable_at is not null) = 0;
