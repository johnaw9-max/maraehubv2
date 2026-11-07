-- Marae settings are now readable by trustees only (they hold bank details and other
-- private settings). Community members still need the marae's NAME and LOCATION for the
-- page header and feedback forms. This returns just those two fields.
create or replace function public.get_marae_display()
returns table (marae_name text, location text)
language sql
stable
security definer
set search_path = public
as $$
  select s.marae_name, s.location from public.marae_settings s limit 1;
$$;

revoke all on function public.get_marae_display() from public, anon;
grant execute on function public.get_marae_display() to authenticated, service_role;
