-- Compliance completion log: one row each time a compliance item is actually done.
-- Why: compliance_items keeps only ONE last_checked_date (overwritten each time), so a
-- marae cannot show an insurer/council/funder WHEN each check was done, by whom, with what proof.
-- ISO 9001 clause 7.5 (documented information / records): records are kept, not overwritten.
-- Design: append-only for trustees (select + insert); only admin trustees may delete (to fix a mistake).

create table if not exists public.compliance_completions (
  id                  uuid primary key default gen_random_uuid(),
  compliance_item_id  uuid not null references public.compliance_items(id) on delete cascade,
  entity_id           uuid references public.entities(id) on delete restrict,
  done_on             date not null,
  done_by             text,
  done_by_user        uuid references auth.users(id) on delete set null,
  note                text,
  document_url        text,
  document_name       text,
  source              text not null default 'done_button',
  created_at          timestamptz not null default now(),
  constraint compliance_completions_note_len check (note is null or char_length(note) <= 500),
  constraint compliance_completions_source_check check (source in ('done_button','manual_backfill','carried_over'))
);

create index if not exists idx_compliance_completions_item
  on public.compliance_completions (compliance_item_id, done_on desc);

alter table public.compliance_completions enable row level security;

create policy "compliance_completions: trustees read within entity"
  on public.compliance_completions as permissive for select to authenticated
  using (((exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'::text))
          and is_entity_member(entity_id)));

create policy "compliance_completions: trustees insert within entity"
  on public.compliance_completions as permissive for insert to authenticated
  with check (((exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'::text))
               and is_entity_member(entity_id)));

create policy "compliance_completions: admin trustees delete"
  on public.compliance_completions as permissive for delete to authenticated
  using ((exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee'::text and profiles.trustee_role = 'admin'::text)));

-- Anonymous visitors get nothing (matches the other compliance tables' intent).
revoke all on table public.compliance_completions from anon;

-- Carry over each item's existing last_checked_date as the first history row, so history starts
-- with what the marae already knows. Idempotent: skipped if the item already has a history row.
insert into public.compliance_completions (compliance_item_id, entity_id, done_on, note, source)
select ci.id, ci.entity_id, ci.last_checked_date, 'Carried over from the last checked date before history was kept.', 'carried_over'
from public.compliance_items ci
where ci.last_checked_date is not null
  and not exists (select 1 from public.compliance_completions cc where cc.compliance_item_id = ci.id);
