-- Hard limit of 3 entities per marae.
--
-- entities has no marae_id column (each Supabase project holds exactly one
-- marae's data - see 20260723000001_add_entities_table.sql), so the limit
-- is a flat count(*) on the table, not a per-marae GROUP BY.
--
-- Can't be a plain CHECK constraint: CHECK only sees the row being written,
-- not sibling rows, and this rule needs count(*) across the whole table.
-- A BEFORE INSERT trigger is the correct primitive for a max-row-count rule.
--
-- Deliberately not locking the table against concurrent inserts (e.g.
-- LOCK TABLE entities IN SHARE ROW EXCLUSIVE MODE) - confirmed with the
-- user this is an acceptable trade-off given the real usage pattern (a
-- handful of trustees occasionally adding entities via a settings screen,
-- not a high-concurrency path).
--
-- Safe to run against both Opeke and Tineka even though Opeke already has
-- 3 entities: this only guards future inserts, it doesn't touch existing rows.
--
-- Idempotent / safe to re-run, matching this repo's migration convention.

create or replace function enforce_entities_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from entities) >= 3 then
    raise exception 'A marae can have at most 3 entities.';
  end if;
  return new;
end;
$$;

drop trigger if exists entities_limit_trigger on entities;
create trigger entities_limit_trigger
  before insert on entities
  for each row
  execute function enforce_entities_limit();
