select 'project_subtasks_dropped' as check_name,
  not exists(
    select 1 from information_schema.tables
    where table_name = 'project_subtasks'
  ) as result

union all
select 'finance_balance_sheet_dead_columns_dropped',
  not exists(
    select 1 from information_schema.columns
    where table_name = 'finance_balance_sheet'
      and column_name in (
        'investments_term_deposits', 'investments_shares',
        'investments_property', 'investments_other',
        'accounts_payable', 'accounts_payable_notes',
        'other_liabilities', 'other_liabilities_notes'
      )
  );
