-- B3 · Members cannot change the fields trustees control.
-- A policy can limit which rows change but not which columns. This trigger stops a
-- signed-in non-trustee from changing the owner, reference number, entity or
-- creation time of a booking. Server-side callers (service role, no signed-in user)
-- and trustees are not affected.
create or replace function public.protect_booking_trustee_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_trustee() then
    if new.user_id    is distinct from old.user_id
       or new.reference  is distinct from old.reference
       or new.entity_id  is distinct from old.entity_id
       or new.created_at is distinct from old.created_at then
      raise exception 'These booking fields can only be changed by a trustee'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_booking_trustee_fields on public.bookings;
create trigger protect_booking_trustee_fields
  before update on public.bookings
  for each row execute function public.protect_booking_trustee_fields();
