-- Real, pre-existing gap found tonight while diagnosing a real ux_pulse
-- insert failure for Waj. NOT caused by the rating column added earlier
-- (20260818000000) -- feedback.marae has been in schema.sql (Opeke's
-- mirror) since before tonight, and was already flagged as one of the
-- 14 "low-priority" schema_drift findings from the original 16 Aug
-- investigation. Reassessed now as genuinely impactful, not inert --
-- it was silently breaking the already-shipped FeedbackButton.js on
-- Tineka this whole time (confirmed via a real HTTP call reproducing
-- Waj's exact insert shape, PGRST204 "column not found" before this
-- fix, 201 Created after). Opeke confirmed unaffected -- has always
-- had this column.

alter table public.feedback add column if not exists marae text;
