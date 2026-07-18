-- Persistent, resumable bank reconciliation sessions. One row per bank
-- statement (matched by filename + date range), storing a full snapshot
-- of every parsed row and its resolution status so a trustee can close
-- the tab and pick up exactly where they left off, rather than a
-- one-time reconciliation report.

create table if not exists bank_reconciliations (
  id                    uuid        primary key default gen_random_uuid(),
  filename              text        not null,
  statement_start_date  date        not null,
  statement_end_date    date        not null,
  reconciled_by         text,
  reconciled_at         timestamptz not null default now(),
  matched_count         integer     not null default 0,
  added_count           integer     not null default 0,
  unresolved_count      integer     not null default 0,
  rows                  jsonb       not null default '[]'::jsonb,
  constraint bank_reconciliations_statement_key unique (filename, statement_start_date, statement_end_date)
);

alter table bank_reconciliations enable row level security;

create policy "bank_reconciliations: authenticated full access"
  on bank_reconciliations for all
  to authenticated
  using (true)
  with check (true);
