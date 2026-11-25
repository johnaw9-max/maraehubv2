-- Expect: constraint lists 12 types; exactly 1 shared Heat / Hot weather row; other hazard rows unchanged (compare counts before/after).
select (select count(*) from public.emergency_plan_hazards where hazard_type = 'Heat / Hot weather' and entity_id is null) as heat_rows,
       (select pg_get_constraintdef(oid) like '%Heat / Hot weather%' from pg_constraint where conname = 'emergency_plan_hazards_hazard_type_check') as constraint_has_heat;
