-- Bookkeeping for the nightly file backup to S3 (backup-files-to-s3).
-- Service role only: RLS on, no policies, so no signed-in user can read or edit these.

create table if not exists public.backup_file_log (
  bucket_id   text not null,
  object_path text not null,
  version_key text not null,
  size_bytes  bigint,
  copied_at   timestamptz not null default now(),
  primary key (bucket_id, object_path)
);

create table if not exists public.backup_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running' check (status in ('running','ok','partial','failed','error')),
  files_scanned integer not null default 0,
  files_copied  integer not null default 0,
  files_failed  integer not null default 0,
  bytes_copied  bigint not null default 0,
  note          text
);

alter table public.backup_file_log enable row level security;
alter table public.backup_runs enable row level security;
