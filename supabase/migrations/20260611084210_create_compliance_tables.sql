-- NOTE (2026-07-23): the compliance_items policy below ("authenticated full
-- access") was superseded by 20260723000000_fix_compliance_items_rls.sql,
-- which restricts it to trustees only, matching risk_register. Left
-- unmodified here since this migration is already marked applied.

-- ── COMPLIANCE ITEMS ──────────────────────────────────────────────────────────
-- Recurring obligations: Building WOFs, insurance, trustee terms, H&S, Civil Defence

create table if not exists compliance_items (
  id              uuid        primary key default gen_random_uuid(),
  category        text        not null
                              check (category in (
                                'building', 'insurance', 'trustee',
                                'health_safety', 'civil_defence', 'other'
                              )),
  name            text        not null,
  due_date        date,
  renewal_months  integer,
  responsible_id  uuid        references profiles(id) on delete set null,
  notes           text,
  document_url    text,
  document_name   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table compliance_items enable row level security;

create policy "compliance_items: authenticated full access"
  on compliance_items for all
  to authenticated
  using (true)
  with check (true);


-- ── INCIDENTS ─────────────────────────────────────────────────────────────────
-- Incident register: H&S incidents, near-misses, property incidents

create table if not exists incidents (
  id              uuid        primary key default gen_random_uuid(),
  incident_date   date        not null default current_date,
  title           text        not null,
  description     text,
  location        text,
  severity        text        not null default 'minor'
                              check (severity in ('minor', 'moderate', 'serious', 'critical')),
  people_involved text,
  responsible_id  uuid        references profiles(id) on delete set null,
  action_taken    text,
  follow_up_date  date,
  resolved        boolean     not null default false,
  document_url    text,
  document_name   text,
  created_at      timestamptz not null default now()
);

alter table incidents enable row level security;

create policy "incidents: authenticated full access"
  on incidents for all
  to authenticated
  using (true)
  with check (true);


-- ── SEED DATA ─────────────────────────────────────────────────────────────────
-- Standard NZ marae compliance obligations — trustees update due_dates as needed

insert into compliance_items (category, name, renewal_months) values
  ('building',      'Building Warrant of Fitness',           12),
  ('insurance',     'Building & Contents Insurance',         12),
  ('insurance',     'Public Liability Insurance',            12),
  ('trustee',       'Trustee Elections / Term Review',       36),
  ('health_safety', 'Health & Safety Policy Review',         12),
  ('health_safety', 'First Aid Kit Inspection',               6),
  ('health_safety', 'Fire Extinguisher Service',             12),
  ('health_safety', 'Emergency Evacuation Drill',            12),
  ('civil_defence', 'Civil Defence Emergency Plan Review',   24),
  ('civil_defence', 'Emergency Contact List Update',         12)
on conflict do nothing;


-- ── STORAGE ───────────────────────────────────────────────────────────────────
-- Create the compliance-docs storage bucket via Supabase dashboard:
--   Storage → New Bucket → name: compliance-docs → Public: true
-- The app handles missing bucket gracefully (logs warning, saves record without file).
