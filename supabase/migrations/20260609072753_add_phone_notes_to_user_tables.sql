-- Add phone and notes to profiles (auth-backed users)
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists notes text;

-- Add email, phone and notes to contacts (no-auth contacts)
alter table contacts add column if not exists email text;
alter table contacts add column if not exists phone text;
alter table contacts add column if not exists notes text;
