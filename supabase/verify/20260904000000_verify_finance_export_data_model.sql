select 'marae_settings_has_gst_registered_default_false' as check_name,
  exists(
    select 1 from information_schema.columns
    where table_name = 'marae_settings' and column_name = 'gst_registered'
      and data_type = 'boolean' and column_default = 'false'
  ) as result

union all
select 'finance_income_has_gst_amount_nullable',
  exists(
    select 1 from information_schema.columns
    where table_name = 'finance_income' and column_name = 'gst_amount'
      and is_nullable = 'YES'
  )

union all
select 'finance_expenses_has_gst_amount_nullable',
  exists(
    select 1 from information_schema.columns
    where table_name = 'finance_expenses' and column_name = 'gst_amount'
      and is_nullable = 'YES'
  )

union all
select 'finance_income_gst_amount_check_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'finance_income' and constraint_name = 'finance_income_gst_amount_check'
  )

union all
select 'finance_expenses_gst_amount_check_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'finance_expenses' and constraint_name = 'finance_expenses_gst_amount_check'
  )

union all
select 'finance_income_has_payer',
  exists(
    select 1 from information_schema.columns
    where table_name = 'finance_income' and column_name = 'payer' and data_type = 'text'
  )

union all
select 'finance_income_has_receipt_url_and_name',
  exists(
    select 1 from information_schema.columns
    where table_name = 'finance_income' and column_name = 'receipt_url'
  )
  and exists(
    select 1 from information_schema.columns
    where table_name = 'finance_income' and column_name = 'receipt_name'
  )

union all
select 'finance_opening_balances_table_exists',
  exists(
    select 1 from information_schema.tables
    where table_name = 'finance_opening_balances'
  )

union all
select 'finance_opening_balances_financial_year_unique',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'finance_opening_balances'
      and constraint_name = 'finance_opening_balances_financial_year_key'
      and constraint_type = 'UNIQUE'
  )

union all
select 'finance_opening_balances_rls_enabled',
  exists(
    select 1 from pg_tables
    where tablename = 'finance_opening_balances' and rowsecurity = true
  )

union all
select 'finance_opening_balances_policy_is_admin_trustee_gated',
  exists(
    select 1 from pg_policies
    where tablename = 'finance_opening_balances'
      and policyname = 'Admin trustees can manage finance_opening_balances'
      and qual like '%trustee_role = ''admin''%'
  )

union all
select 'finance_opening_balances_has_no_seeded_rows',
  (select count(*) from finance_opening_balances) = 0;
