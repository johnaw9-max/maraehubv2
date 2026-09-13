-- Step 2 of the 10-step Future Integrations plan (ClickUp 14yhc7kpjbd), redesigned
-- from an automated grants feed to semi-manual entry after Step 1's research found
-- no real grant source (TPK, Auckland Council, MAS Foundation, Whio Labs, Community
-- Matters) exposes an RSS feed or API -- a trustee will manually log a grant they
-- heard about via GrantsTracker.js's existing Add Grant form, status defaulting to
-- 'researching' as already happens today.
--
-- source_url is the one genuinely new field this requires: nowhere in the existing
-- schema records where a trustee found a grant, and every real source is a static
-- page someone has to go check by hand -- without this, there's no way to navigate
-- back to verify status or find the actual application later.
--
-- No description column added -- the existing notes field (generic, unused in real
-- data) is repurposed via a relabeled placeholder instead, avoiding a redundant
-- column for content that already has a home.

alter table public.grants add column if not exists source_url text;
