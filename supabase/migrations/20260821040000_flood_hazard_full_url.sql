-- Fixes the naturalhazardsportal.govt.nz reference to a real, fully-qualified
-- URL (https://www.naturalhazardsportal.govt.nz) -- the bare domain never
-- matched linkify's https?:// regex, which is why the link rendered as
-- plain text even on a genuinely correct deploy. Tested against the exact
-- linkify logic before applying: confirms a clean 3-part split with the URL
-- isolated correctly, no trailing punctuation caught in the match.

update public.emergency_plan_hazards
set what_to_do = 'Before: check your marae''s real flood risk via your local council''s flood viewer -- https://www.naturalhazardsportal.govt.nz links to every regional council''s own hazard maps -- agree a real evacuation route to higher ground with everyone who uses the site, and keep insurance cover for buildings and contents up to date. During: if water starts rising, head for higher ground immediately -- do not wait for an official warning, and never walk, swim or drive through floodwater, since even shallow-looking water can sweep a person or vehicle away and is likely to be contaminated with sewage, chemicals or farm run-off. Listen to Civil Defence updates and keep a grab bag ready. After: only return once Civil Defence or emergency services confirm it is safe -- receding floodwater doesn''t mean it''s safe to return. Photograph any damage before cleaning up, for insurance purposes, and throw away any food or water that came into contact with floodwater.'
where hazard_type = 'Flood' and entity_id is null;
