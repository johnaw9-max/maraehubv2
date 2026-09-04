-- General Ledger, Stage 2 Step 2a (ClickUp 14yhc7knyea) -- real journal
-- entry/line schema + category-to-account mapping. Schema and a shared
-- posting utility (src/lib/glPosting.js) only -- NOT wired into any of the
-- 15 real write paths across FinanceManager.js/BookingsManager.js/
-- BookingInvoice.js/GrantsTracker.js/BankReconciliation.js yet. That
-- integration is Step 2b, deliberately separate.
--
-- Accrual model: a Pending/unconfirmed row posts immediately to
-- Accounts Receivable/Payable (650/800); when it later clears to
-- Confirmed/Paid, a SEPARATE clearing entry moves it into Bank (600),
-- leaving the original recognition entry untouched. A row that's
-- Confirmed/Paid from its very first save posts straight to Bank --
-- no round-trip through AR/AP for something that was never actually
-- outstanding.

-- ── GL_JOURNAL_ENTRIES ──────────────────────────────────────────────────
create table if not exists gl_journal_entries (
  id uuid not null default gen_random_uuid(),
  entry_date date not null,
  description text not null,
  source_table text,
  source_id uuid,
  entry_type text not null,
  voids_entry_id uuid,
  created_by text,
  created_at timestamp with time zone not null default now()
);

alter table gl_journal_entries add constraint gl_journal_entries_pkey PRIMARY KEY (id);
alter table gl_journal_entries add constraint gl_journal_entries_voids_entry_id_fkey FOREIGN KEY (voids_entry_id) REFERENCES gl_journal_entries(id) ON DELETE SET NULL;
alter table gl_journal_entries add constraint gl_journal_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY['recognition', 'clearing', 'void', 'manual']));
alter table gl_journal_entries add constraint gl_journal_entries_source_table_check
  CHECK (source_table IS NULL OR source_table = ANY (ARRAY['finance_income', 'finance_expenses']));

CREATE INDEX idx_gl_journal_entries_source ON public.gl_journal_entries USING btree (source_table, source_id);
CREATE INDEX idx_gl_journal_entries_date ON public.gl_journal_entries USING btree (entry_date);

alter table gl_journal_entries enable row level security;

create policy "Admin trustees can manage gl_journal_entries"
  on gl_journal_entries for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));

-- ── GL_JOURNAL_LINES ────────────────────────────────────────────────────
create table if not exists gl_journal_lines (
  id uuid not null default gen_random_uuid(),
  journal_entry_id uuid not null,
  account_id uuid not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table gl_journal_lines add constraint gl_journal_lines_pkey PRIMARY KEY (id);
alter table gl_journal_lines add constraint gl_journal_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES gl_journal_entries(id) ON DELETE CASCADE;
alter table gl_journal_lines add constraint gl_journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES gl_accounts(id) ON DELETE RESTRICT;
alter table gl_journal_lines add constraint gl_journal_lines_debit_credit_check
  CHECK (debit >= 0 AND credit >= 0 AND ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)));

CREATE INDEX idx_gl_journal_lines_entry ON public.gl_journal_lines USING btree (journal_entry_id);
CREATE INDEX idx_gl_journal_lines_account ON public.gl_journal_lines USING btree (account_id);

alter table gl_journal_lines enable row level security;

create policy "Admin trustees can manage gl_journal_lines"
  on gl_journal_lines for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));

-- Real integrity, enforced at the schema level: every journal entry's
-- lines must balance (debit = credit) and have at least 2 lines, checked
-- per INSERT statement using a transition table (Postgres 10+) rather
-- than a deferred per-row trigger. This deliberately requires all of an
-- entry's lines to be inserted together in ONE multi-row INSERT -- which
-- is exactly the discipline src/lib/glPosting.js's insertJournalEntry()
-- follows, not a limitation being worked around.
create or replace function check_journal_lines_balance() returns trigger as $$
declare
  r record;
begin
  for r in
    select journal_entry_id, count(*) as n, sum(debit) - sum(credit) as diff
    from new_lines
    group by journal_entry_id
  loop
    if r.n < 2 then
      raise exception 'Journal entry % must have at least 2 lines in one insert (got %)', r.journal_entry_id, r.n;
    end if;
    if abs(r.diff) > 0.01 then
      raise exception 'Journal entry % does not balance: debit-credit diff = %', r.journal_entry_id, r.diff;
    end if;
  end loop;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_check_journal_lines_balance on gl_journal_lines;
create trigger trg_check_journal_lines_balance
  after insert on gl_journal_lines
  referencing new table as new_lines
  for each statement execute function check_journal_lines_balance();

-- ── GL_CATEGORY_ACCOUNT_MAP ─────────────────────────────────────────────
-- Real accounting configuration, not a display label -- kept as a real
-- table (not a hardcoded JS constant) so a correction never needs a code
-- deploy.
create table if not exists gl_category_account_map (
  id uuid not null default gen_random_uuid(),
  category text not null,
  module text not null,
  account_id uuid not null,
  created_at timestamp with time zone not null default now()
);

alter table gl_category_account_map add constraint gl_category_account_map_pkey PRIMARY KEY (id);
alter table gl_category_account_map add constraint gl_category_account_map_account_id_fkey FOREIGN KEY (account_id) REFERENCES gl_accounts(id) ON DELETE RESTRICT;
alter table gl_category_account_map add constraint gl_category_account_map_module_check CHECK (module = ANY (ARRAY['income', 'expense']));
alter table gl_category_account_map add constraint gl_category_account_map_category_module_key UNIQUE (category, module);

alter table gl_category_account_map enable row level security;

create policy "Admin trustees can manage gl_category_account_map"
  on gl_category_account_map for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));

-- 14 of 15 categories map by name to the matching account seeded in Step 1.
-- Equipment is the deliberate exception -- it maps to the Asset account
-- (620), not a 300s Expense account, same reasoning as Step 1.
insert into gl_category_account_map (category, module, account_id)
select v.category, v.module, a.id
from (values
  ('Booking Income',           'income',  200),
  ('Grant Income',             'income',  210),
  ('Koha',                     'income',  220),
  ('Hire Equipment',           'income',  230),
  ('Fundraiser',                'income',  240),
  ('Other',                    'income',  260),
  ('Maintenance and Repairs',  'expense', 300),
  ('Utilities',                'expense', 310),
  ('Insurance',                'expense', 320),
  ('Events',                   'expense', 330),
  ('Administration',           'expense', 340),
  ('Cleaning',                 'expense', 350),
  ('Other',                    'expense', 360),
  ('Wages',                    'expense', 400),
  ('Equipment',                'expense', 620)
) as v(category, module, code)
join gl_accounts a on a.code = v.code;
