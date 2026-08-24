-- Stage 1 of ClickUp 86d44a27n (Building Compliance / BWOF Readiness Post #3
-- audit). Rewrites Tineka's real "Building Warrant of Fitness" item
-- (id e7aab4c7-d171-47d0-9c10-b9f860d226cf) to state the real legal
-- conditionality rather than asserting the obligation unconditionally.
--
-- Building Act 2004 ss100-108: a compliance schedule -- and therefore an
-- annual BWOF -- is only required for a building that actually has one or
-- more "specified systems" (sprinklers, fire alarm, emergency lighting,
-- lifts, mechanical ventilation, etc). A single-storey timber-framed
-- building, which describes most wharenui, typically has none of these
-- and so has no compliance schedule and no BWOF obligation at all. Same
-- discipline as Water's Taumata Arowai deferrals (20260819030000): defer
-- the real determination to the council, do not assert it either way.
--
-- No due_date/responsible_name change -- item was already never-assessed
-- (both null) and stays that way; only the name and legal fields change.

update public.compliance_items set
  name = 'Building Warrant of Fitness — annual renewal (only if your building has a compliance schedule)',
  legal_basis = 'Building Act 2004 ss100–108 — Compliance Schedules and Annual Building Warrant of Fitness',
  legal_basis_detail = 'A Building Warrant of Fitness is only a real, legal obligation if your building has a compliance schedule — issued by your council because the building contains one or more ''specified systems'' (e.g. sprinklers, a fire alarm, emergency lighting, a lift, mechanical ventilation). A single-storey building built only of timber framing, which describes most wharenui, typically has none of these and has no compliance schedule at all — meaning no BWOF requirement. This cannot be determined by MaraeHub. Confirm directly with your council whether your building has a compliance schedule, and record the outcome and any real renewal date here.',
  updated_at = now()
where id = 'e7aab4c7-d171-47d0-9c10-b9f860d226cf';
