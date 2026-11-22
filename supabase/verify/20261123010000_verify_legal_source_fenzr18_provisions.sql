select 'fenzr18_lists_schedule_2_and_regs_5_to_17' as check_name,
  coalesce((select provisions_read from public.legal_sources where key = 'FENZR18'), '') = 'Schedule 2, regs 3, 5 to 17, 25, 29 to 34' as result
union all
select 'still_thirty_sources',
  (select count(*) from public.legal_sources) = 30;
