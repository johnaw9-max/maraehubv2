-- Community members can only read their own bookings (and blocked_dates is trustees-only),
-- so the booking forms could not tell them which dates are taken. This returns ONLY date
-- ranges: no names, occasions, contacts or reasons. Optionally leaves out one booking
-- (the one being edited) so it does not clash with itself.
create or replace function public.get_unavailable_dates(p_exclude_booking uuid default null)
returns table (from_date date, to_date date, kind text)
language sql
stable
security definer
set search_path = public
as $$
  select b.start_date, coalesce(b.end_date, b.start_date), 'booked'::text
    from public.bookings b
   where b.status = 'approved'
     and b.start_date is not null
     and (p_exclude_booking is null or b.id <> p_exclude_booking)
  union all
  select d.from_date, d.to_date, 'blocked'::text
    from public.blocked_dates d
   where d.from_date is not null and d.to_date is not null;
$$;

revoke all on function public.get_unavailable_dates(uuid) from public, anon;
grant execute on function public.get_unavailable_dates(uuid) to authenticated, service_role;
