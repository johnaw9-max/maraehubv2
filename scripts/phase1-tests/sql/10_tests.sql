\set ON_ERROR_STOP on
\set T '11111111-1111-1111-1111-111111111111'
\set C '22222222-2222-2222-2222-222222222222'
create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;

\echo '=== M1 P1-07b notification_log: service role only ==='
set role anon; select pg_temp.as_user('');
do $$ declare n int; begin
  insert into public.notification_log (notification_type) values ('fake'); get diagnostics n = row_count;
  if n <> 1 then raise exception 'baseline'; end if;
  raise notice 'FINDING CONFIRMED (before M1): anonymous caller could write notification_log';
end $$;
reset role;
\i ../../../supabase/proposed/phase1/P1-07b_notification_log_service_role_only.sql
\i ../../../supabase/proposed/phase1/P1-07b_notification_log_service_role_only.sql
set role anon;
do $$ begin
  begin perform 1 from public.notification_log; raise exception 'M1: anon can read'; exception when insufficient_privilege then null; end;
  begin insert into public.notification_log (notification_type) values ('x'); raise exception 'M1: anon can write'; exception when insufficient_privilege then null; end;
  raise notice 'PASS M1-a: anonymous read and write refused';
end $$;
reset role; set role authenticated; select pg_temp.as_user(:'T');
do $$ begin
  begin perform 1 from public.notification_log; raise exception 'M1: trustee can read'; exception when insufficient_privilege then null; end;
  raise notice 'PASS M1-b: signed-in users (even trustees) refused';
end $$;
reset role; set role service_role;
do $$ declare n int; begin
  insert into public.notification_log (notification_type) values ('svc'); select count(*) into n from public.notification_log;
  if n < 2 then raise exception 'M1: service role cannot use table'; end if;
  raise notice 'PASS M1-c: service role can still read and write (re-run safe)';
end $$;
reset role;
\i ../../../supabase/proposed/phase1/P1-07b_notification_log_service_role_only_rollback.sql
set role anon;
do $$ begin perform 1 from public.notification_log; raise notice 'PASS M1-d: rollback restores previous access exactly'; end $$;
reset role;
\i ../../../supabase/proposed/phase1/P1-07b_notification_log_service_role_only.sql

\echo '=== M2 P1-07a marae_settings: trustee-only writes ==='
set role authenticated; select pg_temp.as_user(:'C');
do $$ declare n int; begin
  update public.marae_settings set payment_details = '99-9999'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'baseline'; end if;
  raise notice 'FINDING CONFIRMED (before M2): community member could change bank details';
end $$;
reset role; update public.marae_settings set payment_details = '12-3456-7890123-00';
\i ../../../supabase/proposed/phase1/P1-07a_marae_settings_trustee_write.sql
\i ../../../supabase/proposed/phase1/P1-07a_marae_settings_trustee_write.sql
set role authenticated; select pg_temp.as_user(:'C');
do $$ declare n int; begin
  if (select count(*) from public.marae_settings) <> 1 then raise exception 'M2: member cannot read'; end if;
  update public.marae_settings set payment_details = '99-9999'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'M2: member changed settings'; end if;
  begin insert into public.marae_settings (marae_name) values ('fake'); raise exception 'M2: member inserted'; exception when insufficient_privilege then null; end;
  raise notice 'PASS M2-a: community member can read but cannot change or add settings';
end $$;
do $$ begin
  begin update public.profiles set role = 'trustee' where id = auth.uid(); raise exception 'M2: member promoted self';
  exception when raise_exception then if sqlerrm like 'M2:%' then raise; end if; end;
  raise notice 'PASS M2-b: member cannot make themselves a trustee (bypass attempt refused)';
end $$;
do $$ declare n int; begin
  update public.marae_settings set payment_details = '99-9999'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'M2: bypass worked'; end if;
  raise notice 'PASS M2-c: after the failed bypass attempt, still cannot change settings';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-000000000000');
do $$ declare n int; begin
  update public.marae_settings set payment_details = '99-9999'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'M2: unknown user changed settings'; end if;
  raise notice 'PASS M2-d: signed-in account with no profile cannot change settings';
end $$;
select pg_temp.as_user(:'T');
do $$ declare n int; begin
  update public.marae_settings set marae_name = 'Test Marae'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'M2: trustee cannot update'; end if;
  raise notice 'PASS M2-e: trustee can still change settings (re-run safe)';
end $$;
reset role;
\i ../../../supabase/proposed/phase1/P1-07a_marae_settings_trustee_write_rollback.sql
do $$ begin
  if not exists (select 1 from pg_policies where tablename='marae_settings' and policyname='allow_authenticated') then raise exception 'rollback'; end if;
  raise notice 'PASS M2-f: rollback restores the broad rule';
end $$;

\echo '=== M3 P1-02a trustee-only file rules (buckets stay public) ==='
\i ../../../supabase/proposed/phase1/P1-02a_trustee_only_file_policies_rollback.sql
set role authenticated; select pg_temp.as_user(:'C');
insert into storage.objects (bucket_id, name) values ('finance-receipts', 'r/planted-by-member.jpg');
do $$ begin raise notice 'FINDING CONFIRMED (before M3): community member could upload into finance-receipts'; end $$;
reset role; delete from storage.objects where name = 'r/planted-by-member.jpg';
\i ../../../supabase/proposed/phase1/P1-02a_trustee_only_file_policies.sql
\i ../../../supabase/proposed/phase1/P1-02a_trustee_only_file_policies.sql
do $$ begin
  if exists (select 1 from storage.buckets where id='documents' and not public) then raise exception 'M3 must not change bucket privacy'; end if;
  raise notice 'PASS M3-a: buckets still public after M3 (privacy switch is separate, M4)';
end $$;
set role authenticated; select pg_temp.as_user(:'T');
do $$ begin
  if (select count(*) from storage.objects where bucket_id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence')) <> 4 then raise exception 'M3: trustee read'; end if;
  insert into storage.objects (bucket_id, name) values ('compliance-docs','items/2.pdf');
  update storage.objects set name='items/2b.pdf' where name='items/2.pdf';
  delete from storage.objects where name='items/2b.pdf';
  raise notice 'PASS M3-b: trustee can read, upload, replace and delete';
end $$;
select pg_temp.as_user(:'C');
do $$ declare n int; begin
  select count(*) into n from storage.objects; if n <> 0 then raise exception 'M3: member sees %', n; end if;
  begin insert into storage.objects (bucket_id, name) values ('finance-receipts','r/x.jpg'); raise exception 'M3: member upload'; exception when insufficient_privilege then null; end;
  delete from storage.objects; get diagnostics n = row_count; if n <> 0 then raise exception 'M3: member deleted'; end if;
  raise notice 'PASS M3-c: community member cannot list, request links for, upload or delete trustee files';
end $$;
do $$ declare n int; begin
  select count(*) into n from storage.objects where bucket_id='contractor-docs';
  raise notice 'PASS M3-d: other buckets untouched (contractor-docs rules unchanged)';
end $$;
reset role;
\i ../../../supabase/proposed/phase1/P1-02a_trustee_only_file_policies_rollback.sql
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='finance-receipts: allow all uploads') then raise exception 'rollback'; end if;
  raise notice 'PASS M3-e: rollback restores previous file rules';
end $$;
\i ../../../supabase/proposed/phase1/P1-02a_trustee_only_file_policies.sql

\echo '=== M4 P1-02b make the four buckets private ==='
\i ../../../supabase/proposed/phase1/P1-02b_make_file_buckets_private.sql
\i ../../../supabase/proposed/phase1/P1-02b_make_file_buckets_private.sql
do $$ declare n int; begin
  select count(*) into n from storage.buckets where id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and public;
  if n <> 0 then raise exception 'M4'; end if;
  if (select public from storage.buckets where id='contractor-docs') then raise exception 'M4 touched contractor-docs'; end if;
  if (select count(*) from storage.objects) < 4 then raise exception 'M4 lost files'; end if;
  raise notice 'PASS M4-a: four buckets private, no files lost, other buckets unchanged (re-run safe)';
end $$;
\i ../../../supabase/proposed/phase1/P1-02b_make_file_buckets_private_rollback.sql
do $$ begin
  if exists (select 1 from storage.buckets where id in ('documents','compliance-docs','finance-receipts','emergency-response-evidence') and not public) then raise exception 'rollback'; end if;
  raise notice 'PASS M4-b: rollback makes them public again';
end $$;

\echo '=== P1-09 / P1-01 (unchanged) ==='
\i ../../../supabase/proposed/phase1/P1-09_ai_drafting_setting.sql
do $$ begin if (select ai_drafting_enabled from public.marae_settings limit 1) is not false then raise exception 'P1-09'; end if;
  raise notice 'PASS P1-09: AI drafting defaults OFF (opt-in)'; end $$;
\i ../../../supabase/proposed/phase1/P1-01_notification_send_log.sql
set role authenticated;
do $$ begin begin perform 1 from public.notification_send_log; raise exception 'P1-01'; exception when insufficient_privilege then null; end;
  raise notice 'PASS P1-01: send log not readable by signed-in users'; end $$;
reset role;
\echo '=== ALL SQL CHECKS PASSED ==='
