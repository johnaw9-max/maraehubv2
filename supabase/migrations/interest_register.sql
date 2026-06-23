-- Interest Register: formal record of conflicts of interest declared by trustees

create table if not exists interest_register (
  id                  uuid primary key default gen_random_uuid(),
  trustee_name        text not null,
  nature_of_interest  text,
  related_matter      text,
  date_declared       date,
  status              text not null default 'Active',
  created_at          timestamptz default now()
);

alter table interest_register enable row level security;

create policy "Trustees can manage interest register"
  on interest_register
  for all
  using (true)
  with check (true);
