-- Stage 1 of the Flood/Emergency Preparedness Readiness work (ClickUp
-- 86d43pxzb). Populates real likely_impact/what_to_do content for the
-- existing 'Flood' hazard type in Emergency Plan -- unlike Water
-- Contamination, Flood already exists as a hazard type on both projects
-- (no CHECK constraint change needed), so this is a pure UPDATE, not an
-- insert. Content sourced directly from Get Ready / National Emergency
-- Management Agency guidance (fetched 21 Aug 2026), same pattern as the
-- existing Water Contamination entry.

update public.emergency_plan_hazards
set
  likely_impact = 'Flooding can affect a marae directly -- floodwater entering the wharenui, wharekai or other buildings, damaging structures, contents and stored kai, and contaminating any on-site water supply. Rising water can also cut off access roads, isolating the marae and anyone sheltering there until floodwater recedes and access is confirmed safe. Risk is highest during large gatherings (tangihanga, hui, wānanga) when the most people are on site at once, and during or after heavy or prolonged rain when local waterways and stormwater systems are most likely to overflow.',
  what_to_do = 'Before: check with your local council whether the marae is in a flood-risk area, agree a real evacuation route to higher ground with everyone who uses the site, and keep insurance cover for buildings and contents up to date. During: if water starts rising, head for higher ground immediately -- do not wait for an official warning, and never walk, swim or drive through floodwater, since even shallow-looking water can sweep a person or vehicle away and is likely to be contaminated with sewage, chemicals or farm run-off. Listen to Civil Defence updates and keep a grab bag ready. After: only return once Civil Defence or emergency services confirm it is safe -- receding floodwater doesn''t mean it''s safe to return. Photograph any damage before cleaning up, for insurance purposes, and throw away any food or water that came into contact with floodwater.'
where hazard_type = 'Flood' and entity_id is null;
