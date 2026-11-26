-- A link from a risk, asset or grant back to the hui it came from (minutes reader).
-- Nullable and additive: existing rows and screens are unaffected. Safe to run more than once.
-- Apply to a marae's database BEFORE switching the minutes reader on for it.
alter table public.risk_register add column if not exists source_meeting_id uuid references public.meetings(id) on delete set null;
alter table public.assets        add column if not exists source_meeting_id uuid references public.meetings(id) on delete set null;
alter table public.grants        add column if not exists source_meeting_id uuid references public.meetings(id) on delete set null;
comment on column public.risk_register.source_meeting_id is 'Hui whose minutes this risk was taken from, if any.';
comment on column public.assets.source_meeting_id        is 'Hui whose minutes this asset was taken from, if any.';
comment on column public.grants.source_meeting_id        is 'Hui whose minutes this grant was taken from, if any.';
