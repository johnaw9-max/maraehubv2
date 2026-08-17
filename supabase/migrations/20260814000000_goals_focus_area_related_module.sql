-- Goals: two-dimensional category redesign (ClickUp 86d410evh, TPK Marae
-- Development Plan Guide find). Replaces the single free-standing
-- `category` field's role with two real, independently-usable dimensions:
--
--   focus_area      -- "why does this goal matter" -- the 5 values-based
--                       categories from Te Puni Kokiri's real Marae
--                       Development Plan Guide (2018), plus a 6th "General"
--                       fallback for goals that genuinely don't fit any of
--                       the 5 (confirmed deliberate addition, not silent).
--   related_module   -- "where does this goal live day-to-day" -- optional,
--                       tags a goal against MaraeHub's real existing tabs
--                       (verified against TrusteeDashboard.js's NAV_GROUPS
--                       directly, not guessed).
--
-- The old `category` column is deliberately kept, not dropped -- cheap to
-- keep, gives a clean rollback path, matches this session's established
-- caution around destructive schema changes.
--
-- Backfill mapping (documented, not guessed -- see conversation record for
-- the full reasoning): only assets->Facilities and whakapapa->Cultural have
-- a genuinely clean Focus Area fit; everything else honestly defaults to
-- General. Most old categories map cleanly onto related_module instead,
-- since the old single axis was itself mostly operational, not values-based.

alter table goals add column if not exists focus_area text;
alter table goals add column if not exists related_module text;

update goals set focus_area = case category
  when 'assets'     then 'Facilities'
  when 'whakapapa'  then 'Cultural'
  else 'General'
end
where focus_area is null;

update goals set related_module = case category
  when 'compliance' then 'Compliance'
  when 'projects'   then 'Projects'
  when 'funding'    then 'Grants'
  when 'assets'     then 'Assets'
  when 'finance'    then 'Finance'
  else null
end
where related_module is null;

alter table goals alter column focus_area set not null;

alter table goals add constraint goals_focus_area_check
  check (focus_area = any (array['Cultural','Facilities','Health & Wellbeing','Rangatahi','Taonga preservation','General']));

alter table goals add constraint goals_related_module_check
  check (related_module is null or related_module = any (array['Compliance','Risk Register','Finance','Assets','Bookings','Grants','Projects','Contacts','Documents','Emergency Plan']));
