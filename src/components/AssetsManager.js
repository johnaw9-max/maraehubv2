create table assets (
  id uuid default gen_random_uuid() primary key,
  name text,
  category text,
  location text,
  condition text check (condition in ('good','fair','poor')),
  value numeric,
  notes text,
  created_at timestamp default now()
);

create table service_reminders (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references assets(id) on delete cascade,
  type text not null,
  due_date date not null,
  recurring text default 'annual',
  notes text,
  created_at timestamp default now()
);
