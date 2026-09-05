select 'compliance_items_has_linked_expense_id' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'compliance_items' and column_name = 'linked_expense_id'
  ) as result

union all
select 'linked_expense_id_fk_targets_finance_expenses',
  exists(
    select 1
    from information_schema.constraint_column_usage ccu
    join information_schema.table_constraints tc on tc.constraint_name = ccu.constraint_name
    where tc.table_name = 'compliance_items' and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'finance_expenses'
  )

union all
select 'no_compliance_items_linked_yet',
  (select count(*) from compliance_items where linked_expense_id is not null) = 0;
