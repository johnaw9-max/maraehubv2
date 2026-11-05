-- Minimal stand-in for the Supabase pieces the Phase 1 migrations rely on:
-- anon/authenticated roles, auth.uid(), auth.users, storage.buckets/objects
-- (RLS on), profiles (own-row read) and marae_settings (pre-Phase-1 policy).
-- For local testing only. Never run against a real project.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

create table public.profiles (id uuid primary key references auth.users(id), email text, role text, trustee_role text default 'standard');
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
grant select on public.profiles to authenticated;

create table public.marae_settings (id uuid primary key default gen_random_uuid(), marae_name text, payment_details text);
alter table public.marae_settings enable row level security;
create policy "allow_authenticated" on public.marae_settings for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.marae_settings to authenticated;

-- Seed: one trustee (T), one community member (C), four public buckets, one file each.
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222') on conflict do nothing;
insert into public.profiles values
  ('11111111-1111-1111-1111-111111111111', 'trustee@marae.nz', 'trustee', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'member@whanau.nz', 'community', 'standard');
insert into storage.buckets (id, name, public) values
  ('documents','documents',true), ('compliance-docs','compliance-docs',true),
  ('finance-receipts','finance-receipts',true), ('emergency-response-evidence','emergency-response-evidence',true),
  ('contractor-docs','contractor-docs',false);
insert into storage.objects (bucket_id, name) values
  ('documents','documents/1-plan.pdf'), ('compliance-docs','items/1-wof.pdf'),
  ('finance-receipts','r/1-receipt.jpg'), ('emergency-response-evidence','e/1-photo.jpg');
insert into public.marae_settings (marae_name, payment_details) values ('Test Marae', '12-3456-7890123-00');

-- notification_log as live on test/Terere/Ōpeke before Phase 1 (open to public role).
create table public.notification_log (id uuid primary key default gen_random_uuid(), notification_type text, entity_id text, entity_key text, trustee_id uuid, sent_at timestamptz default now());
alter table public.notification_log enable row level security;
create policy "Service role full access to notification_log" on public.notification_log for all to public using (true) with check (true);
grant select, insert, update, delete on public.notification_log to anon, authenticated;
