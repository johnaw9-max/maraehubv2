-- One-off and repeating events for the Calendar (working bee, practice, community day).
-- Trustees only, like meetings and blocked dates. Nothing existing is changed.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  event_date date not null,
  end_date date,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  check (end_date is null or end_date >= event_date)
);

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events: trustees only" on public.calendar_events;
create policy "calendar_events: trustees only" on public.calendar_events
  for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'trustee'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'trustee'));
