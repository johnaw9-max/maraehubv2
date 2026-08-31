select 'risk_remediation_plan_template_exists' as check_name,
  exists(select 1 from workflow_templates where name = 'Risk Remediation Plan') as result
union all
select 'risk_remediation_plan_has_5_steps',
  (select count(*) from workflow_steps where template_id = (select id from workflow_templates where name = 'Risk Remediation Plan')) = 5
union all
select 'risk_register_has_workflow_prompt_dismissed_at',
  exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'risk_register' and column_name = 'workflow_prompt_dismissed_at'
      and data_type = 'timestamp with time zone' and is_nullable = 'YES'
  ) as result;
