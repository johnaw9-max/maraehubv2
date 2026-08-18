-- Real, additive schema change for the "Was this easy to use?" trustee
-- feedback prompt (86d422twn). Reuses the existing feedback table
-- (general-purpose, not tied to any specific booking/entity) rather
-- than a new table -- type='ux_pulse' distinguishes these from the
-- existing bug/suggestion/question/compliment rows, and 'up'/'down'
-- stores the real 👍/👎 answer. Nullable, existing rows unaffected.

alter table public.feedback add column rating text;
