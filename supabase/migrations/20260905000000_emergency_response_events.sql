-- Post #13 (Marae as Emergency Infrastructure, ClickUp 86d42x3kq). Real
-- audit found MaraeHub helps a marae PREPARE for emergencies (Emergency
-- Plan content, compliance checklist) but has no way to record what it
-- has actually DONE -- real, dated proof of service (sheltering people,
-- providing meals during a real event) is exactly what funding advocacy
-- needs and exactly what's missing.
--
-- Deliberately a new table/section, not folded into the existing
-- Compliance "incidents" register -- that register is framed entirely as
-- an adverse-event/H&S log (severity levels, "steps taken to address the
-- incident"). Mixing "we sheltered 40 people during a cyclone" into the
-- same list as "someone slipped on wet flooring" would conflate two
-- genuinely different kinds of record.

create table if not exists emergency_response_events (
  id uuid not null default gen_random_uuid(),
  entity_id uuid,
  event_date date not null,
  event_name text not null,
  description text not null,
  people_served integer,
  duration_days integer,
  document_url text,
  document_name text,
  created_at timestamp with time zone not null default now()
);

alter table emergency_response_events add constraint emergency_response_events_pkey PRIMARY KEY (id);
alter table emergency_response_events add constraint emergency_response_events_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table emergency_response_events add constraint emergency_response_events_people_served_check CHECK (people_served IS NULL OR people_served >= 0);
alter table emergency_response_events add constraint emergency_response_events_duration_days_check CHECK (duration_days IS NULL OR duration_days >= 0);

CREATE INDEX idx_emergency_response_events_date ON public.emergency_response_events USING btree (event_date);

alter table emergency_response_events enable row level security;

-- Same shape as emergency_plan_people's real RLS -- any trustee (not
-- admin-only, unlike Finance) within their entity, matching how the rest
-- of Emergency Plan already works.
create policy "Trustees can manage emergency response events within their entities"
  on emergency_response_events for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee')
    and is_entity_member(entity_id)
  );

-- Public bucket, same pattern as compliance-docs/finance-receipts (not
-- meeting-attachments' private/signed-URL pattern) -- this evidence is
-- meant to be referenced directly in the Emergency Readiness Summary
-- print output, including by people outside the app (a funder reading a
-- printed/shared copy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('emergency-response-evidence', 'emergency-response-evidence', true, null, null)
on conflict (id) do nothing;

create policy "emergency-response-evidence: allow all uploads"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'emergency-response-evidence')
  with check (bucket_id = 'emergency-response-evidence');
