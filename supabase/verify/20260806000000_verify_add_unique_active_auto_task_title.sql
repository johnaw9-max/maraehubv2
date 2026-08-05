select 'idx_tasks_unique_active_auto_title_exists' as check_name,
  exists(select 1 from pg_indexes where indexname = 'idx_tasks_unique_active_auto_title') as result
union all
select 'index_is_unique',
  coalesce((
    select ix.indisunique
    from pg_index ix
    join pg_class c on c.oid = ix.indexrelid
    where c.relname = 'idx_tasks_unique_active_auto_title'
  ), false)
union all
select 'index_is_partial',
  coalesce((
    select ix.indpred is not null
    from pg_index ix
    join pg_class c on c.oid = ix.indexrelid
    where c.relname = 'idx_tasks_unique_active_auto_title'
  ), false);
