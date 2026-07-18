-- Lets a trustee attach an existing file (e.g. a Word doc/PDF of past
-- minutes) to a meeting record, alongside or instead of structured data.

alter table meetings
  add column if not exists attachment_url text,
  add column if not exists attachment_name text;
