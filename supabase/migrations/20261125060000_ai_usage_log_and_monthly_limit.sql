-- AI usage record and per-marae monthly limit (AI secretary foundations, spec v0.2 section 8, risk R6).
-- The table holds counts and status only: never notes, never AI text. Only the server (service role) reads or writes it.
-- Safe to run more than once.
create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  feature text not null default 'draft-minutes',
  input_chars integer,
  input_tokens integer,
  output_tokens integer,
  status text not null
);
alter table public.ai_usage_log enable row level security;
-- No policies on purpose: no trustee or other signed-in user can read or write this table directly.
comment on table public.ai_usage_log is 'AI usage counts per request. No notes or AI output stored. Server-side only.';
create index if not exists ai_usage_log_created_at_idx on public.ai_usage_log (created_at);

alter table public.marae_settings
  add column if not exists ai_monthly_limit integer not null default 30;
comment on column public.marae_settings.ai_monthly_limit is 'Max AI minutes drafts per calendar month (UTC) for this marae. Default 30.';
