-- Stage (priority) for compliance items: 1 = Start here, 2 = Next, 3 = Later.
-- Null = no stage. The tracker only shows stage tabs once at least one item has a stage,
-- so marae with no staged items see no change. Existing RLS on compliance_items covers it.
alter table public.compliance_items add column if not exists stage smallint;
alter table public.compliance_items drop constraint if exists compliance_items_stage_check;
alter table public.compliance_items add constraint compliance_items_stage_check check (stage is null or stage in (1, 2, 3));
