-- Verify-file for migration 20260804000000_fix_risk_register_public_rls.sql.
-- Run via scripts/deploy-migration.sh as the second (verify-file) argument.

select 'policy_exists' as check_name,
  exists(
    select 1 from pg_policies
    where tablename = 'risk_register' and policyname = 'Trustees can manage risks'
  ) as result
union all
select 'restricted_to_authenticated_role',
  coalesce((
    select roles = array['authenticated']::name[]
    from pg_policies
    where tablename = 'risk_register' and policyname = 'Trustees can manage risks'
  ), false)
union all
select 'using_clause_checks_trustee_role',
  coalesce((
    select qual <> 'true' and qual ilike '%role = ''trustee''%'
    from pg_policies
    where tablename = 'risk_register' and policyname = 'Trustees can manage risks'
  ), false)
union all
select 'with_check_clause_checks_trustee_role',
  coalesce((
    select with_check <> 'true' and with_check ilike '%role = ''trustee''%'
    from pg_policies
    where tablename = 'risk_register' and policyname = 'Trustees can manage risks'
  ), false);
