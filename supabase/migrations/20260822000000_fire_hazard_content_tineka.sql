-- Fire Safety Readiness -- backfills the empty Fire hazard entry in
-- Emergency Plan on Tineka. Tineka only ever got test fixtures for the
-- fire safety compliance flow (2e624f2); the real hazard content built
-- for Opeke in Stage 3 (014487a) was never carried across. Same exact
-- wording as Opeke, grounded in the real Fire and Emergency NZ marae
-- evacuation scheme exemplar.

update public.emergency_plan_hazards
set
  likely_impact = 'Fire can destroy the wharenui, wharekai and other buildings — along with irreplaceable taonga and marae records — in minutes. Most marae buildings are older timber construction and Fire and Emergency NZ says most marae pose a significant fire and evacuation risk. Risk is highest during large gatherings (tangihanga, hui, wānanga) when buildings are at full occupancy. Rural or isolated marae may also face longer Fire and Emergency response times.',
  what_to_do = 'If you discover a fire or smoke: shout "Fire, Fire, Fire" / "He ahi, He ahi" to alert others, and activate the nearest manual call point or alarm if fitted. Call 111 and ask for Fire — give the marae name, address, nearest intersection and nature of the emergency. Evacuate immediately via the nearest safe exit and help others evacuate, especially those needing assistance. Only use a fire extinguisher if trained and the fire is small and early-stage — evacuation always comes first. Go to the assembly point (front car park, clear of the main driveway) and report to the Fire Warden. Do not re-enter the building until Fire and Emergency NZ gives the all-clear.'
where id = 'a4544da6-7c08-48bd-b37e-9745f380e01d';
