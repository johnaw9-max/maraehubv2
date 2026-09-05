select 'assets_has_linked_document_id' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'assets' and column_name = 'linked_document_id'
  ) as result

union all
select 'linked_document_id_fk_targets_documents',
  exists(
    select 1
    from information_schema.constraint_column_usage ccu
    join information_schema.table_constraints tc on tc.constraint_name = ccu.constraint_name
    where tc.table_name = 'assets' and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'documents'
  )

union all
select 'no_assets_linked_yet',
  (select count(*) from assets where linked_document_id is not null) = 0;
