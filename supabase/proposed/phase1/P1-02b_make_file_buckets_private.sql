-- M4 · P1-02b · Turn off public access on the four trustee buckets.
-- The only statement is an UPDATE of the "public" switch on four bucket records.
-- No files are deleted or moved. Old public file addresses stop opening; the
-- app (PR #3) opens files through 1-hour signed links instead.
-- Apply only after M3, and on a live marae only after PR #3 is live there.
begin;
update storage.buckets set public = false
 where id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence');
commit;
