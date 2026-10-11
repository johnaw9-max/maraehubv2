-- Adds a real, sourced addition to the Flood 'Before' guidance: moving
-- taonga, important documents and equipment to higher ground ahead of
-- rising water. Sourced from the national CDEM "consistent messages" flood
-- content (fetched 24 Aug 2026, verified against Canterbury CDEM and
-- Nelson Tasman CDEM, both mirroring getready.govt.nz/civildefence.govt.nz):
-- "Move valuable and dangerous items, including electrical equipment and
-- chemicals, as high above the floor as possible... Use watertight
-- containers to store important items." "Taonga" and "documents" are a
-- marae-context translation of "valuable/important items", not verbatim
-- government wording -- worth being honest that this is an application of
-- the guidance, not a direct quote on that specific point.

update public.emergency_plan_hazards
set
  what_to_do = 'Before: check your marae''s real flood risk via your local council''s flood viewer -- https://www.naturalhazardsportal.govt.nz links to every regional council''s own hazard maps -- agree a real evacuation route to higher ground with everyone who uses the site, and keep insurance cover for buildings and contents up to date. Where you can, move taonga, important documents and equipment as high above the floor as possible -- ideally in watertight containers -- while there''s still time before water rises. During: if water starts rising, head for higher ground immediately -- do not wait for an official warning, and never walk, swim or drive through floodwater, since even shallow-looking water can sweep a person or vehicle away and is likely to be contaminated with sewage, chemicals or farm run-off. Listen to Civil Defence updates and keep a grab bag ready. After: only return once Civil Defence or emergency services confirm it is safe -- receding floodwater doesn''t mean it''s safe to return. Photograph any damage before cleaning up, for insurance purposes, and throw away any food or water that came into contact with floodwater.'
where hazard_type = 'Flood' and entity_id is null;
