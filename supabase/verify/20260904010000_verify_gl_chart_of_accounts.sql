select 'gl_accounts_table_exists' as check_name,
  exists(select 1 from information_schema.tables where table_name = 'gl_accounts') as result

union all
select 'gl_accounts_row_count_is_25',
  (select count(*) from gl_accounts) = 25

union all
select 'gl_accounts_all_five_types_present',
  (select count(distinct account_type) from gl_accounts) = 5

union all
select 'gl_accounts_code_unique_constraint_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'gl_accounts' and constraint_name = 'gl_accounts_code_key'
      and constraint_type = 'UNIQUE'
  )

union all
select 'gl_accounts_account_type_check_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'gl_accounts' and constraint_name = 'gl_accounts_account_type_check'
  )

union all
select 'gl_accounts_normal_balance_check_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'gl_accounts' and constraint_name = 'gl_accounts_normal_balance_check'
  )

union all
select 'gl_accounts_code_range_check_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'gl_accounts' and constraint_name = 'gl_accounts_code_range_check'
  )

union all
select 'gl_accounts_rls_enabled',
  exists(
    select 1 from pg_tables
    where tablename = 'gl_accounts' and rowsecurity = true
  )

union all
select 'gl_accounts_policy_is_admin_trustee_gated',
  exists(
    select 1 from pg_policies
    where tablename = 'gl_accounts'
      and policyname = 'Admin trustees can manage gl_accounts'
      and qual like '%trustee_role = ''admin''%'
  )

union all
select 'gl_accounts_all_normal_balances_correct_for_type',
  not exists(
    select 1 from gl_accounts
    where (account_type in ('Asset', 'Expense') and normal_balance <> 'Debit')
       or (account_type in ('Liability', 'Equity', 'Revenue') and normal_balance <> 'Credit')
  )

union all
select 'gl_accounts_all_codes_in_range_for_type',
  not exists(
    select 1 from gl_accounts
    where not (
      (account_type = 'Revenue'   and code between 200 and 299) or
      (account_type = 'Expense'   and code between 300 and 499) or
      (account_type = 'Asset'     and code between 600 and 799) or
      (account_type = 'Liability' and code between 800 and 899) or
      (account_type = 'Equity'    and code between 900 and 999)
    )
  )

union all
select 'equipment_is_asset_620_not_an_expense_account',
  exists(select 1 from gl_accounts where code = 620 and name = 'Equipment & Assets' and account_type = 'Asset')
  and not exists(select 1 from gl_accounts where account_type = 'Expense' and name ilike '%equipment%')

union all
select 'fourteen_categories_map_by_name_to_an_account',
  (
    select count(*) from unnest(array[
      'Booking Income','Grant Income','Koha','Hire Equipment','Fundraiser','Other Income',
      'Maintenance and Repairs','Utilities','Insurance','Events','Administration','Cleaning','Other Expenses','Wages'
    ]) as cat
    where exists(select 1 from gl_accounts where gl_accounts.name = cat)
  ) = 14;
