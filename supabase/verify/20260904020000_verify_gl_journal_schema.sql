-- ── REAL BEHAVIORAL TEST of the balance trigger, run first so its result
-- can be folded into the one final SELECT below (this tool only surfaces
-- the last statement's result set). Uses a real temporary table
-- (session-scoped, auto-dropped) to carry the DO blocks' outcomes.

create temporary table gl_trigger_test_result (label text primary key, passed boolean) on commit drop;

do $$
declare
  v_entry_id uuid;
  v_bank_id uuid;
  v_koha_id uuid;
begin
  select id into v_bank_id from gl_accounts where code = 600;
  select id into v_koha_id from gl_accounts where code = 220;

  begin
    insert into gl_journal_entries (entry_date, description, entry_type)
    values (current_date, 'TEST unbalanced -- must be rejected', 'manual')
    returning id into v_entry_id;

    -- Deliberately unbalanced: 100 debit vs 50 credit.
    insert into gl_journal_lines (journal_entry_id, account_id, debit, credit) values
      (v_entry_id, v_bank_id, 100, 0),
      (v_entry_id, v_koha_id, 0, 50);

    -- Reached only if the trigger failed to reject the bad insert.
    insert into gl_trigger_test_result values ('rejected_unbalanced', false);
    delete from gl_journal_entries where id = v_entry_id;
  exception when others then
    insert into gl_trigger_test_result values ('rejected_unbalanced', true);
  end;
end $$;

-- Balanced 3-line (GST-style) insert -- must succeed, then gets cleaned up.
do $$
declare
  v_entry_id uuid;
  v_bank_id uuid;
  v_koha_id uuid;
  v_gst_id uuid;
begin
  select id into v_bank_id from gl_accounts where code = 600;
  select id into v_koha_id from gl_accounts where code = 220;
  select id into v_gst_id from gl_accounts where code = 820;

  begin
    insert into gl_journal_entries (entry_date, description, entry_type)
    values (current_date, 'TEST balanced 3-line -- must succeed, then cleaned up', 'manual')
    returning id into v_entry_id;

    insert into gl_journal_lines (journal_entry_id, account_id, debit, credit) values
      (v_entry_id, v_bank_id, 115, 0),
      (v_entry_id, v_koha_id, 0, 100),
      (v_entry_id, v_gst_id, 0, 15);

    insert into gl_trigger_test_result values ('accepted_balanced', true);
    delete from gl_journal_entries where id = v_entry_id;
  exception when others then
    insert into gl_trigger_test_result values ('accepted_balanced', false);
  end;
end $$;

-- ── FINAL, SINGLE RESULT SET ─────────────────────────────────────────────

select 'gl_journal_entries_table_exists' as check_name,
  exists(select 1 from information_schema.tables where table_name = 'gl_journal_entries') as result

union all
select 'gl_journal_lines_table_exists',
  exists(select 1 from information_schema.tables where table_name = 'gl_journal_lines')

union all
select 'gl_category_account_map_table_exists',
  exists(select 1 from information_schema.tables where table_name = 'gl_category_account_map')

union all
select 'gl_category_account_map_has_15_rows',
  (select count(*) from gl_category_account_map) = 15

union all
select 'category_map_equipment_points_to_asset_620',
  exists(
    select 1 from gl_category_account_map m
    join gl_accounts a on a.id = m.account_id
    where m.category = 'Equipment' and m.module = 'expense' and a.code = 620 and a.account_type = 'Asset'
  )

union all
select 'category_map_other_income_and_other_expense_both_exist_distinctly',
  (select count(*) from gl_category_account_map where category = 'Other') = 2

union all
select 'gl_journal_lines_debit_credit_check_exists',
  exists(
    select 1 from information_schema.table_constraints
    where table_name = 'gl_journal_lines' and constraint_name = 'gl_journal_lines_debit_credit_check'
  )

union all
select 'gl_journal_lines_balance_trigger_exists',
  exists(select 1 from pg_trigger where tgname = 'trg_check_journal_lines_balance')

union all
select 'gl_journal_entries_rls_enabled',
  exists(select 1 from pg_tables where tablename = 'gl_journal_entries' and rowsecurity = true)

union all
select 'gl_journal_lines_rls_enabled',
  exists(select 1 from pg_tables where tablename = 'gl_journal_lines' and rowsecurity = true)

union all
select 'gl_category_account_map_rls_enabled',
  exists(select 1 from pg_tables where tablename = 'gl_category_account_map' and rowsecurity = true)

union all
select 'balance_trigger_rejected_unbalanced_insert',
  coalesce((select passed from gl_trigger_test_result where label = 'rejected_unbalanced'), false)

union all
select 'balance_trigger_accepted_balanced_3line_insert',
  coalesce((select passed from gl_trigger_test_result where label = 'accepted_balanced'), false)

union all
select 'gl_journal_entries_still_empty_after_tests',
  (select count(*) from gl_journal_entries) = 0

union all
select 'gl_journal_lines_still_empty_after_tests',
  (select count(*) from gl_journal_lines) = 0;
