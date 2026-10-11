select 'workflow_templates_total_count' as check_name, (select count(*) from workflow_templates) = 27 as result
union all
select 'template_exists: AGM Preparation', exists(select 1 from workflow_templates where name = 'AGM Preparation')
union all
select 'template_exists: Annual Asset Inspection', exists(select 1 from workflow_templates where name = 'Annual Asset Inspection')
union all
select 'template_exists: Building Maintenance and Repair', exists(select 1 from workflow_templates where name = 'Building Maintenance and Repair')
union all
select 'template_exists: Charter Review and Update', exists(select 1 from workflow_templates where name = 'Charter Review and Update')
union all
select 'template_exists: Civil Defence Emergency Plan Review', exists(select 1 from workflow_templates where name = 'Civil Defence Emergency Plan Review')
union all
select 'template_exists: Contractor Vetting and Approval', exists(select 1 from workflow_templates where name = 'Contractor Vetting and Approval')
union all
select 'template_exists: Drought / Water Shortage Response', exists(select 1 from workflow_templates where name = 'Drought / Water Shortage Response')
union all
select 'template_exists: Evacuation Routes Review', exists(select 1 from workflow_templates where name = 'Evacuation Routes Review')
union all
select 'template_exists: Facility Hire Agreement', exists(select 1 from workflow_templates where name = 'Facility Hire Agreement')
union all
select 'template_exists: Fire Safety Compliance Check', exists(select 1 from workflow_templates where name = 'Fire Safety Compliance Check')
union all
select 'template_exists: Food Safety Compliance', exists(select 1 from workflow_templates where name = 'Food Safety Compliance')
union all
select 'template_exists: Generator Test and Service', exists(select 1 from workflow_templates where name = 'Generator Test and Service')
union all
select 'template_exists: Grant Application', exists(select 1 from workflow_templates where name = 'Grant Application')
union all
select 'template_exists: Health & Safety Incident Response', exists(select 1 from workflow_templates where name = 'Health & Safety Incident Response')
union all
select 'template_exists: Heat Pump Service', exists(select 1 from workflow_templates where name = 'Heat Pump Service')
union all
select 'template_exists: Marae Emergency Readiness Starter Pack', exists(select 1 from workflow_templates where name = 'Marae Emergency Readiness Starter Pack')
union all
select 'template_exists: Marae Insurance Renewal', exists(select 1 from workflow_templates where name = 'Marae Insurance Renewal')
union all
select 'template_exists: Marae Structure Storm Readiness Check', exists(select 1 from workflow_templates where name = 'Marae Structure Storm Readiness Check')
union all
select 'template_exists: MaraeHub Onboarding', exists(select 1 from workflow_templates where name = 'MaraeHub Onboarding')
union all
select 'template_exists: New Trustee Appointment', exists(select 1 from workflow_templates where name = 'New Trustee Appointment')
union all
select 'template_exists: Quarterly Trustee Meeting', exists(select 1 from workflow_templates where name = 'Quarterly Trustee Meeting')
union all
select 'template_exists: Risk Remediation Plan', exists(select 1 from workflow_templates where name = 'Risk Remediation Plan')
union all
select 'template_exists: Role Setup', exists(select 1 from workflow_templates where name = 'Role Setup')
union all
select 'template_exists: Tangihanga Preparation', exists(select 1 from workflow_templates where name = 'Tangihanga Preparation')
union all
select 'template_exists: Trustee Elections and Term Review', exists(select 1 from workflow_templates where name = 'Trustee Elections and Term Review')
union all
select 'template_exists: Water Contamination Response', exists(select 1 from workflow_templates where name = 'Water Contamination Response')
union all
select 'template_exists: Water Tank Inspection', exists(select 1 from workflow_templates where name = 'Water Tank Inspection')
union all
select 'step_count: AGM Preparation', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'AGM Preparation') = 10
union all
select 'step_count: Annual Asset Inspection', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Annual Asset Inspection') = 10
union all
select 'step_count: Building Maintenance and Repair', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Building Maintenance and Repair') = 10
union all
select 'step_count: Charter Review and Update', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Charter Review and Update') = 10
union all
select 'step_count: Civil Defence Emergency Plan Review', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Civil Defence Emergency Plan Review') = 10
union all
select 'step_count: Contractor Vetting and Approval', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Contractor Vetting and Approval') = 10
union all
select 'step_count: Drought / Water Shortage Response', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Drought / Water Shortage Response') = 9
union all
select 'step_count: Evacuation Routes Review', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Evacuation Routes Review') = 6
union all
select 'step_count: Facility Hire Agreement', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Facility Hire Agreement') = 10
union all
select 'step_count: Fire Safety Compliance Check', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Fire Safety Compliance Check') = 10
union all
select 'step_count: Food Safety Compliance', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Food Safety Compliance') = 10
union all
select 'step_count: Generator Test and Service', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Generator Test and Service') = 7
union all
select 'step_count: Grant Application', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Grant Application') = 10
union all
select 'step_count: Health & Safety Incident Response', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Health & Safety Incident Response') = 10
union all
select 'step_count: Heat Pump Service', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Heat Pump Service') = 10
union all
select 'step_count: Marae Emergency Readiness Starter Pack', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Marae Emergency Readiness Starter Pack') = 10
union all
select 'step_count: Marae Insurance Renewal', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Marae Insurance Renewal') = 10
union all
select 'step_count: Marae Structure Storm Readiness Check', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Marae Structure Storm Readiness Check') = 6
union all
select 'step_count: MaraeHub Onboarding', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'MaraeHub Onboarding') = 10
union all
select 'step_count: New Trustee Appointment', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'New Trustee Appointment') = 10
union all
select 'step_count: Quarterly Trustee Meeting', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Quarterly Trustee Meeting') = 10
union all
select 'step_count: Risk Remediation Plan', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Risk Remediation Plan') = 5
union all
select 'step_count: Role Setup', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Role Setup') = 7
union all
select 'step_count: Tangihanga Preparation', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Tangihanga Preparation') = 10
union all
select 'step_count: Trustee Elections and Term Review', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Trustee Elections and Term Review') = 8
union all
select 'step_count: Water Contamination Response', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Water Contamination Response') = 10
union all
select 'step_count: Water Tank Inspection', (select count(*) from workflow_steps ws join workflow_templates wt on ws.template_id = wt.id where wt.name = 'Water Tank Inspection') = 7
union all
select 'checklist_templates_total_count', (select count(*) from checklist_templates) = 5
union all
select 'checklist_exists: Lock all doors and windows', exists(select 1 from checklist_templates where label = 'Lock all doors and windows')
union all
select 'checklist_exists: Turn off all lights', exists(select 1 from checklist_templates where label = 'Turn off all lights')
union all
select 'checklist_exists: Check for left belongings', exists(select 1 from checklist_templates where label = 'Check for left belongings')
union all
select 'checklist_exists: Empty rubbish bins', exists(select 1 from checklist_templates where label = 'Empty rubbish bins')
union all
select 'checklist_exists: Report any damage to trustees', exists(select 1 from checklist_templates where label = 'Report any damage to trustees');
