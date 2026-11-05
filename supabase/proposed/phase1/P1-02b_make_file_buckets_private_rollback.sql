-- Rollback for M4: turns public access back on for the same four buckets.
begin;
update storage.buckets set public = true
 where id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence');
commit;
