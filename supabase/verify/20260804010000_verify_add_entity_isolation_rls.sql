-- Verify-file for migration 20260804010000_add_entity_isolation_rls.sql.
-- Run via scripts/deploy-migration.sh as the second (verify-file) argument.
-- Structural checks only (objects exist, policies replaced) - the real
-- behavioral proof (negative/self-assign-blocked/admin-bypass/positive)
-- is done separately via impersonated db query sessions, not here.

select 'trustee_entities_table_exists' as check_name,
  exists(select 1 from information_schema.tables where table_name = 'trustee_entities') as result
union all
select 'trustee_entities_rls_enabled',
  coalesce((select relrowsecurity from pg_class where relname = 'trustee_entities'), false)
union all
select 'is_entity_member_function_exists',
  exists(select 1 from pg_proc where proname = 'is_entity_member')
union all
select 'is_entity_member_is_security_invoker',
  coalesce((
    select not p.prosecdef from pg_proc p where p.proname = 'is_entity_member'
  ), false)
union all
select 'finance_income_policy_updated',
  exists(select 1 from pg_policies where tablename = 'finance_income' and policyname = 'Trustees can manage finance_income within their entities')
union all
select 'finance_expenses_policy_updated',
  exists(select 1 from pg_policies where tablename = 'finance_expenses' and policyname = 'Trustees can manage finance_expenses within their entities')
union all
select 'compliance_items_policy_updated',
  exists(select 1 from pg_policies where tablename = 'compliance_items' and policyname = 'Trustees can manage compliance_items within their entities')
union all
select 'risk_register_policy_updated',
  exists(select 1 from pg_policies where tablename = 'risk_register' and policyname = 'Trustees can manage risk_register within their entities')
union all
select 'old_finance_income_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'finance_income' and policyname = 'finance_income: authenticated full access')
union all
select 'old_finance_expenses_policy_gone',
  not exists(select 1 from pg_policies where tablename = 'finance_expenses' and policyname = 'finance_expenses: authenticated full access');
