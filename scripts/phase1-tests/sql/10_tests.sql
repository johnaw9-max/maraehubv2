\set ON_ERROR_STOP on
\set T '11111111-1111-1111-1111-111111111111'
\set C '22222222-2222-2222-2222-222222222222'

-- helper: count rows visible / affected as a given user
create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;

\echo '=== P1-02 baseline (pre-Phase-1 policies, recreated by the rollback file) ==='
\i ../../../supabase/proposed/phase1/P1-02_private_file_buckets_rollback.sql
set role authenticated; select pg_temp.as_user(:'C');
insert into storage.objects (bucket_id, name) values ('finance-receipts', 'r/planted-by-member.jpg');
do $$ begin
  if (select count(*) from storage.objects where bucket_id='finance-receipts') < 2 then raise exception 'baseline: expected member insert to succeed'; end if;
  raise notice 'FINDING CONFIRMED: community member could upload into finance-receipts under the old policy';
end $$;
reset role;
delete from storage.objects where name = 'r/planted-by-member.jpg';

\echo '=== P1-02 apply Release 2 ==='
\i ../../../supabase/proposed/phase1/P1-02_private_file_buckets.sql
do $$ begin
  if exists (select 1 from storage.buckets where id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and public) then raise exception 'P1-02: a bucket is still public'; end if;
  if (select public from storage.buckets where id='contractor-docs') then raise exception 'P1-02: contractor-docs changed'; end if;
  raise notice 'PASS P1-02-a: four buckets private; contractor-docs untouched';
end $$;

set role authenticated; select pg_temp.as_user(:'T');
do $$ begin
  if (select count(*) from storage.objects) <> 4 then raise exception 'P1-02: trustee should see 4 files, saw %', (select count(*) from storage.objects); end if;
  insert into storage.objects (bucket_id, name) values ('compliance-docs', 'items/2-new.pdf');
  update storage.objects set name = 'items/2-renamed.pdf' where name = 'items/2-new.pdf';
  delete from storage.objects where name = 'items/2-renamed.pdf';
  raise notice 'PASS P1-02-b: trustee can read, upload, replace and delete';
end $$;

select pg_temp.as_user(:'C');
do $$ declare n int; begin
  select count(*) into n from storage.objects;
  if n <> 0 then raise exception 'P1-02: member should see 0 files, saw %', n; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('finance-receipts', 'r/x.jpg');
    raise exception 'P1-02: member upload should be refused';
  exception when insufficient_privilege then null; end;
  delete from storage.objects; get diagnostics n = row_count;
  if n <> 0 then raise exception 'P1-02: member deleted % files', n; end if;
  raise notice 'PASS P1-02-c: community member cannot read, upload or delete';
end $$;
reset role;

set role anon; select pg_temp.as_user('');
do $$ begin
  if (select count(*) from storage.objects) <> 0 then raise exception 'P1-02: anon can see files'; end if;
  raise notice 'PASS P1-02-d: anonymous caller sees no files';
end $$;
reset role;

\echo '=== P1-02 re-run safety, rollback, re-apply ==='
\i ../../../supabase/proposed/phase1/P1-02_private_file_buckets.sql
\i ../../../supabase/proposed/phase1/P1-02_private_file_buckets_rollback.sql
do $$ begin
  if exists (select 1 from storage.buckets where id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and not public) then raise exception 'rollback: bucket not public'; end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='finance-receipts: allow all uploads') then raise exception 'rollback: old policy missing'; end if;
  raise notice 'PASS P1-02-e: re-run safe; rollback restores previous public state and policies';
end $$;
\i ../../../supabase/proposed/phase1/P1-02_private_file_buckets_rollback.sql
\i ../../../supabase/proposed/phase1/P1-02_private_file_buckets.sql
do $$ begin
  if exists (select 1 from storage.buckets where id='finance-receipts' and public) then raise exception 're-apply failed'; end if;
  raise notice 'PASS P1-02-f: rollback is re-runnable and forward re-applies after rollback';
end $$;

\echo '=== P1-07a marae_settings ==='
set role authenticated; select pg_temp.as_user(:'C');
do $$ declare n int; begin
  update public.marae_settings set payment_details = '99-9999-9999999-99'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'baseline: expected member update to succeed'; end if;
  raise notice 'FINDING CONFIRMED: community member could change bank details under the old policy';
end $$;
reset role;
update public.marae_settings set payment_details = '12-3456-7890123-00';
\i ../../../supabase/proposed/phase1/P1-07a_marae_settings_trustee_write.sql
\i ../../../supabase/proposed/phase1/P1-07a_marae_settings_trustee_write.sql
set role authenticated; select pg_temp.as_user(:'C');
do $$ declare n int; begin
  if (select count(*) from public.marae_settings) <> 1 then raise exception 'P1-07a: member can no longer read settings'; end if;
  update public.marae_settings set payment_details = '99-9999-9999999-99'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'P1-07a: member still updated settings'; end if;
  raise notice 'PASS P1-07a-a: member can read settings but not change them (re-run safe)';
end $$;
select pg_temp.as_user(:'T');
do $$ declare n int; begin
  update public.marae_settings set marae_name = 'Test Marae'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'P1-07a: trustee cannot update'; end if;
  raise notice 'PASS P1-07a-b: trustee can still change settings';
end $$;
reset role;
\i ../../../supabase/proposed/phase1/P1-07a_marae_settings_trustee_write_rollback.sql
\i ../../../supabase/proposed/phase1/P1-07a_marae_settings_trustee_write_rollback.sql
do $$ begin
  if not exists (select 1 from pg_policies where tablename='marae_settings' and policyname='allow_authenticated') then raise exception 'rollback failed'; end if;
  raise notice 'PASS P1-07a-c: rollback restores the previous policy (re-run safe)';
end $$;

\echo '=== P1-09 ai_drafting_enabled ==='
\i ../../../supabase/proposed/phase1/P1-09_ai_drafting_setting.sql
\i ../../../supabase/proposed/phase1/P1-09_ai_drafting_setting.sql
do $$ begin
  if (select ai_drafting_enabled from public.marae_settings limit 1) is not false then raise exception 'P1-09: existing marae not defaulted off'; end if;
  raise notice 'PASS P1-09-a: opt-in (D-09) - existing marae default to AI drafting OFF; re-run safe';
end $$;
\i ../../../supabase/proposed/phase1/P1-09_ai_drafting_setting_rollback.sql
do $$ begin
  if exists (select 1 from information_schema.columns where table_name='marae_settings' and column_name='ai_drafting_enabled') then raise exception 'rollback failed'; end if;
  raise notice 'PASS P1-09-b: rollback removes the column';
end $$;

\echo '=== P1-01 notification_send_log ==='
\i ../../../supabase/proposed/phase1/P1-01_notification_send_log.sql
\i ../../../supabase/proposed/phase1/P1-01_notification_send_log.sql
insert into public.notification_send_log (user_id, caller, recipient_count) values (:'T', 'trustee', 2);
set role authenticated; select pg_temp.as_user(:'T');
do $$ begin
  begin
    perform 1 from public.notification_send_log;
    raise exception 'P1-01: signed-in user could read the send log';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS P1-01-a: send log not readable by signed-in users (edge function only); re-run safe';
end $$;
reset role;
\i ../../../supabase/proposed/phase1/P1-01_notification_send_log_rollback.sql
do $$ begin
  if to_regclass('public.notification_send_log') is not null then raise exception 'rollback failed'; end if;
  raise notice 'PASS P1-01-b: rollback removes the table';
end $$;
\echo '=== ALL SQL CHECKS PASSED ==='
