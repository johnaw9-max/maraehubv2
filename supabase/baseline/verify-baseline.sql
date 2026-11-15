-- Run on a freshly built project AFTER the baseline. Every row should say ok = true.
select 'tables' as what, 66 as expected, (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as actual
union all select 'functions', 26, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
union all select 'indexes', 103, (select count(*) from pg_indexes where schemaname='public')
union all select 'policies (public)', 109, (select count(*) from pg_policies where schemaname='public')
union all select 'policies (storage)', 15, (select count(*) from pg_policies where schemaname='storage')
union all select 'buckets', 7, (select count(*) from storage.buckets);
