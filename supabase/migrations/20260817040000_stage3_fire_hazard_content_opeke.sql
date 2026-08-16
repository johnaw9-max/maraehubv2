-- Stage 3 of Fire Safety Readiness -- populates the real, empty Fire
-- hazard entry in Emergency Plan on Opeke. Content grounded in the
-- real Fire and Emergency NZ marae evacuation scheme exemplar (alert
-- procedure, warden reporting, assembly point convention), not
-- generic text. All 9 hazard types on Opeke were found completely
-- empty during this audit -- Fire is the one in scope for this task;
-- the other 8 remain a separate, unaddressed gap.

update public.emergency_plan_hazards
set
  likely_impact = 'Fire can destroy the wharenui, wharekai and other buildings — along with irreplaceable taonga and marae records — in minutes. Most marae buildings are older timber construction and Fire and Emergency NZ says most marae pose a significant fire and evacuation risk. Risk is highest during large gatherings (tangihanga, hui, wānanga) when buildings are at full occupancy. Rural or isolated marae may also face longer Fire and Emergency response times.',
  what_to_do = 'If you discover a fire or smoke: shout "Fire, Fire, Fire" / "He ahi, He ahi" to alert others, and activate the nearest manual call point or alarm if fitted. Call 111 and ask for Fire — give the marae name, address, nearest intersection and nature of the emergency. Evacuate immediately via the nearest safe exit and help others evacuate, especially those needing assistance. Only use a fire extinguisher if trained and the fire is small and early-stage — evacuation always comes first. Go to the assembly point (front car park, clear of the main driveway) and report to the Fire Warden. Do not re-enter the building until Fire and Emergency NZ gives the all-clear.'
where id = '94bdf2ad-724a-4070-9bd1-528d3e10b290';
