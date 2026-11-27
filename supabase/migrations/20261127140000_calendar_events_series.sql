-- Dates added together by "Repeat" share a series id, so an edit can change one date or all of them.
-- Events added before this have no series and can only be edited one date at a time.
alter table public.calendar_events add column if not exists series_id uuid;
