select 'compliance_items_has_linked_document_id' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compliance_items' and column_name = 'linked_document_id'
      and data_type = 'uuid' and is_nullable = 'YES'
  ) as result
union all
select 'linked_document_id_fk_set_null',
  exists(
    select 1 from pg_constraint
    where conrelid = 'compliance_items'::regclass
      and confrelid = 'documents'::regclass
      and confdeltype = 'n'
  ) as result;
