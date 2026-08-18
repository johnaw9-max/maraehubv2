-- ──────────────────────────────────────────────────────────────────────────────
-- MaraeHub — Complete Database Schema
-- ──────────────────────────────────────────────────────────────────────────────
-- Regenerated from live Opeke (cbeenkpjpnhmtqtnjiyd) via information_schema/
-- pg_catalog introspection, most recently 2026-08-18 (previously 2026-08-17).
-- This re-sync exists specifically to close the schema_drift check's own
-- known, previously-observed-live limitation (ClickUp 86d3u7790): nothing
-- enforces this file getting regenerated when new migrations land.
-- Real diff this time, computed directly against live Opeke before
-- editing anything, not assumed: profiles and contacts both gained
-- is_fire_warden boolean (migration 20260817120000, Fire Warden
-- Contacts checkbox/filter work). compliance_items' earlier
-- classification/legal_basis/legal_basis_detail/workflow_template_id
-- catch-up (20260817000000) is also now genuinely classified for real
-- rows, not just column-added -- 5 of Opeke's real items were
-- reclassified to workflow with real linked templates same session
-- (20260817010000, 20260817020000), the other 10 correctly stay task.
-- goals.focus_area/related_module (86d410evh) were already captured
-- here from an earlier session, confirmed still accurate.
-- 45 real base tables (the pre-existing xero_connection_status VIEW is
-- correctly excluded).
-- Tables are listed alphabetically (not dependency order — accuracy over
-- runnable ordering; foreign keys mean this file is not guaranteed to run
-- top-to-bottom against a fresh empty database without reordering).
-- ──────────────────────────────────────────────────────────────────────────────

-- ── ACTION_REMINDER_TOKENS ────────────────────────────────────────────────
create table if not exists action_reminder_tokens (
  id uuid not null default gen_random_uuid(),
  meeting_action_id uuid not null,
  trustee_id uuid not null,
  resolved_name text not null,
  resolved_email text not null,
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null default (now() + '14 days'::interval),
  used_at timestamp with time zone
);

alter table action_reminder_tokens add constraint action_reminder_tokens_pkey PRIMARY KEY (id);
alter table action_reminder_tokens add constraint action_reminder_tokens_meeting_action_id_fkey FOREIGN KEY (meeting_action_id) REFERENCES meeting_actions(id) ON DELETE CASCADE;
alter table action_reminder_tokens add constraint action_reminder_tokens_trustee_id_fkey FOREIGN KEY (trustee_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_action_reminder_tokens_meeting_action_id ON public.action_reminder_tokens USING btree (meeting_action_id);

alter table action_reminder_tokens enable row level security;


-- ── ASSETS ────────────────────────────────────────────────────────────────
create table if not exists assets (
  id uuid not null default gen_random_uuid(),
  name text,
  category text,
  location text,
  condition text,
  value numeric,
  last_service date,
  next_service date,
  notes text,
  created_at timestamp without time zone default now(),
  purchase_date date,
  purchase_cost numeric,
  lifespan_years integer,
  replacement_cost numeric,
  replacement_date date,
  inventory_category text,
  quantity integer,
  last_stocktake date,
  entity_id uuid
);

alter table assets add constraint assets_pkey PRIMARY KEY (id);
alter table assets add constraint assets_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table assets add constraint assets_condition_check CHECK ((condition = ANY (ARRAY['excellent'::text, 'good'::text, 'fair'::text, 'poor'::text, 'critical'::text])));
alter table assets add constraint assets_category_check CHECK ((category = ANY (ARRAY['Building'::text, 'Equipment'::text, 'Vehicle'::text, 'Technology'::text, 'Grounds'::text, 'Other'::text, 'Inventory'::text])));

alter table assets enable row level security;

create policy "Trustees can manage assets within their entities"
  on assets for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── BANK_RECONCILIATIONS ──────────────────────────────────────────────────
create table if not exists bank_reconciliations (
  id uuid not null default gen_random_uuid(),
  filename text not null,
  statement_start_date date not null,
  statement_end_date date not null,
  reconciled_by text,
  reconciled_at timestamp with time zone not null default now(),
  matched_count integer not null default 0,
  added_count integer not null default 0,
  unresolved_count integer not null default 0,
  rows jsonb not null default '[]'::jsonb
);

alter table bank_reconciliations add constraint bank_reconciliations_pkey PRIMARY KEY (id);
alter table bank_reconciliations add constraint bank_reconciliations_statement_key UNIQUE (filename, statement_start_date, statement_end_date);

alter table bank_reconciliations enable row level security;

create policy "bank_reconciliations: authenticated full access"
  on bank_reconciliations for all
  to authenticated
  using (true)
  with check (true);


-- ── BLOCKED_DATES ─────────────────────────────────────────────────────────
create table if not exists blocked_dates (
  id uuid not null default gen_random_uuid(),
  from_date date not null,
  to_date date not null,
  reason text,
  created_at timestamp without time zone default now()
);

alter table blocked_dates add constraint blocked_dates_pkey PRIMARY KEY (id);

alter table blocked_dates enable row level security;

create policy "allow_authenticated"
  on blocked_dates for all
  to authenticated
  using (true)
  with check (true);


-- ── BOOKING_CHECKLISTS ────────────────────────────────────────────────────
create table if not exists booking_checklists (
  id uuid not null default gen_random_uuid(),
  booking_id uuid,
  items jsonb,
  completed_by text,
  completed_at timestamp without time zone,
  notes text,
  created_at timestamp without time zone default now(),
  completed boolean not null default false
);

alter table booking_checklists add constraint booking_checklists_pkey PRIMARY KEY (id);
alter table booking_checklists add constraint booking_checklists_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

alter table booking_checklists enable row level security;

create policy "allow_authenticated"
  on booking_checklists for all
  to authenticated
  using (true)
  with check (true);


-- ── BOOKING_FEEDBACK ──────────────────────────────────────────────────────
create table if not exists booking_feedback (
  id uuid not null default gen_random_uuid(),
  booking_id uuid,
  rating_overall integer,
  rating_cleanliness integer,
  rating_facilities integer,
  experience text,
  would_return boolean,
  suggestions text,
  created_at timestamp without time zone default now(),
  user_id uuid
);

alter table booking_feedback add constraint booking_feedback_pkey PRIMARY KEY (id);
alter table booking_feedback add constraint booking_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table booking_feedback add constraint booking_feedback_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table booking_feedback add constraint booking_feedback_rating_check CHECK (((rating_overall >= 1) AND (rating_overall <= 5)));
alter table booking_feedback add constraint booking_feedback_facilities_check CHECK (((rating_facilities >= 1) AND (rating_facilities <= 5)));
alter table booking_feedback add constraint booking_feedback_cleanliness_check CHECK (((rating_cleanliness >= 1) AND (rating_cleanliness <= 5)));

alter table booking_feedback enable row level security;

create policy "allow_authenticated"
  on booking_feedback for all
  to authenticated
  using (true)
  with check (true);


-- ── BOOKINGS ──────────────────────────────────────────────────────────────
create table if not exists bookings (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  occasion text,
  start_date date,
  end_date date,
  guests integer,
  overnight boolean default false,
  facilities _text[],
  iwi text,
  notes text,
  status text default 'pending'::text,
  reference text,
  created_at timestamp without time zone default now(),
  contact_name text,
  contact_phone text,
  contact_email text,
  entity_id uuid
);

alter table bookings add constraint bookings_pkey PRIMARY KEY (id);
alter table bookings add constraint bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table bookings add constraint bookings_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table bookings add constraint bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])));

alter table bookings enable row level security;

create policy "Trustees within entity or own bookings"
  on bookings for all
  to authenticated
  using ((((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)) OR (user_id = auth.uid())))
  with check ((((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)) OR (user_id = auth.uid())));


-- ── CHECKLIST_TEMPLATES ───────────────────────────────────────────────────
create table if not exists checklist_templates (
  id uuid not null default gen_random_uuid(),
  items jsonb,
  updated_at timestamp without time zone default now(),
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table checklist_templates add constraint checklist_templates_pkey PRIMARY KEY (id);

alter table checklist_templates enable row level security;

create policy "allow_authenticated"
  on checklist_templates for all
  to authenticated
  using (true)
  with check (true);


-- ── COMPLIANCE_ITEMS ──────────────────────────────────────────────────────
create table if not exists compliance_items (
  id uuid not null default gen_random_uuid(),
  category text not null,
  name text not null,
  due_date date,
  renewal_months integer,
  responsible_name text,
  notes text,
  document_url text,
  document_name text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_checked_date date,
  entity_id uuid,
  classification text not null default 'task',
  legal_basis text,
  legal_basis_detail text,
  workflow_template_id uuid
);

alter table compliance_items add constraint compliance_items_pkey PRIMARY KEY (id);
alter table compliance_items add constraint compliance_items_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table compliance_items add constraint compliance_items_category_check CHECK ((category = ANY (ARRAY['building'::text, 'insurance'::text, 'trustee'::text, 'health_safety'::text, 'civil_defence'::text, 'other'::text, 'emergency_preparedness'::text])));
alter table compliance_items add constraint compliance_items_classification_check CHECK ((classification = ANY (ARRAY['task'::text, 'template'::text, 'workflow'::text])));
alter table compliance_items add constraint compliance_items_workflow_template_id_fkey FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id);

alter table compliance_items enable row level security;

create policy "Trustees can manage compliance_items within their entities"
  on compliance_items for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── CONTACTS ──────────────────────────────────────────────────────────────
create table if not exists contacts (
  id uuid not null default gen_random_uuid(),
  full_name text not null,
  role text default 'community'::text,
  email text,
  phone text,
  notes text,
  created_at timestamp without time zone default now(),
  is_fire_warden boolean not null default false
);

alter table contacts add constraint contacts_pkey PRIMARY KEY (id);

alter table contacts enable row level security;

create policy "allow_authenticated"
  on contacts for all
  to authenticated
  using (true)
  with check (true);


-- ── CONTRACTORS ───────────────────────────────────────────────────────────
create table if not exists contractors (
  id uuid not null default gen_random_uuid(),
  name text not null,
  trade text,
  company text,
  phone text,
  email text,
  address text,
  notes text,
  preferred boolean default false,
  created_at timestamp without time zone default now(),
  document_url text,
  document_name text
);

alter table contractors add constraint contractors_pkey PRIMARY KEY (id);

alter table contractors enable row level security;

create policy "allow_authenticated"
  on contractors for all
  to authenticated
  using (true)
  with check (true);


-- ── DOCUMENTS ─────────────────────────────────────────────────────────────
create table if not exists documents (
  id uuid not null default gen_random_uuid(),
  title text not null,
  category text,
  notes text,
  file_name text,
  file_size bigint,
  file_type text,
  file_url text,
  created_at timestamp without time zone default now(),
  entity_id uuid
);

alter table documents add constraint documents_pkey PRIMARY KEY (id);
alter table documents add constraint documents_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;

alter table documents enable row level security;

create policy "Trustees can manage documents within their entities"
  on documents for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── EMERGENCY_PLAN_HAZARDS ────────────────────────────────────────────────
create table if not exists emergency_plan_hazards (
  id uuid not null default gen_random_uuid(),
  hazard_type text not null,
  likely_impact text,
  what_to_do text,
  entity_id uuid,
  created_at timestamp with time zone not null default now()
);

alter table emergency_plan_hazards add constraint emergency_plan_hazards_pkey PRIMARY KEY (id);
alter table emergency_plan_hazards add constraint emergency_plan_hazards_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table emergency_plan_hazards add constraint emergency_plan_hazards_hazard_type_check CHECK ((hazard_type = ANY (ARRAY['Landslide'::text, 'Flood'::text, 'Earthquake'::text, 'Fire'::text, 'Storm'::text, 'Tsunami'::text, 'Volcano'::text, 'Pandemic'::text, 'Man-Made Hazard'::text])));

alter table emergency_plan_hazards enable row level security;

create policy "Trustees can manage emergency plan hazards within their entitie"
  on emergency_plan_hazards for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── EMERGENCY_PLAN_PEOPLE ─────────────────────────────────────────────────
create table if not exists emergency_plan_people (
  id uuid not null default gen_random_uuid(),
  role_category text not null,
  full_name text not null,
  phone text,
  skill_type text,
  entity_id uuid,
  created_at timestamp with time zone not null default now()
);

alter table emergency_plan_people add constraint emergency_plan_people_pkey PRIMARY KEY (id);
alter table emergency_plan_people add constraint emergency_plan_people_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table emergency_plan_people add constraint emergency_plan_people_role_category_check CHECK ((role_category = ANY (ARRAY['marae_contact'::text, 'emergency_contact'::text, 'marae_operator'::text, 'first_aider'::text, 'specialised_skill'::text])));

alter table emergency_plan_people enable row level security;

create policy "Trustees can manage emergency plan people within their entities"
  on emergency_plan_people for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── ENTITIES ──────────────────────────────────────────────────────────────
create table if not exists entities (
  id uuid not null default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone not null default now()
);

alter table entities add constraint entities_pkey PRIMARY KEY (id);
alter table entities add constraint entities_name_key UNIQUE (name);

alter table entities enable row level security;

create policy "Trustees can manage entities"
  on entities for all
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));


-- ── FEEDBACK ──────────────────────────────────────────────────────────────
create table if not exists feedback (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  user_name text,
  user_email text,
  type text,
  message text,
  page text,
  created_at timestamp without time zone default now(),
  marae text,
  rating text
);

alter table feedback add constraint feedback_pkey PRIMARY KEY (id);

alter table feedback enable row level security;

create policy "allow_authenticated"
  on feedback for all
  to authenticated
  using (true)
  with check (true);


-- ── FINANCE_BALANCE_SHEET ─────────────────────────────────────────────────
create table if not exists finance_balance_sheet (
  id uuid not null default gen_random_uuid(),
  cash_balance numeric not null default 0,
  other_assets numeric not null default 0,
  other_assets_notes text,
  loans numeric not null default 0,
  loans_notes text,
  outstanding_payments numeric not null default 0,
  outstanding_notes text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  term_deposits numeric default 0,
  shares_bonds numeric default 0,
  property_investments numeric default 0,
  other_investments numeric default 0,
  investments_notes text
);

alter table finance_balance_sheet add constraint finance_balance_sheet_pkey PRIMARY KEY (id);

alter table finance_balance_sheet enable row level security;

create policy "finance_balance_sheet: authenticated full access"
  on finance_balance_sheet for all
  to authenticated
  using (true)
  with check (true);


-- ── FINANCE_BUDGETS ───────────────────────────────────────────────────────
create table if not exists finance_budgets (
  id uuid not null default gen_random_uuid(),
  financial_year integer not null,
  category text not null,
  amount numeric not null default 0,
  updated_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

alter table finance_budgets add constraint finance_budgets_pkey PRIMARY KEY (id);
alter table finance_budgets add constraint finance_budgets_financial_year_category_key UNIQUE (financial_year, category);

CREATE INDEX idx_finance_budgets_fy ON public.finance_budgets USING btree (financial_year);

alter table finance_budgets enable row level security;

create policy "finance_budgets: authenticated full access"
  on finance_budgets for all
  to authenticated
  using (true)
  with check (true);


-- ── FINANCE_EXPENSES ──────────────────────────────────────────────────────
create table if not exists finance_expenses (
  id uuid not null default gen_random_uuid(),
  date date not null,
  description text not null,
  amount numeric not null default 0,
  category text not null default 'Other'::text,
  payee text,
  reference text,
  receipt_url text,
  receipt_name text,
  notes text,
  status text not null default 'Paid'::text,
  created_at timestamp with time zone not null default now(),
  entity_id uuid
);

alter table finance_expenses add constraint finance_expenses_pkey PRIMARY KEY (id);
alter table finance_expenses add constraint finance_expenses_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table finance_expenses add constraint finance_expenses_category_check CHECK ((category = ANY (ARRAY['Maintenance and Repairs'::text, 'Utilities'::text, 'Insurance'::text, 'Events'::text, 'Administration'::text, 'Wages'::text, 'Equipment'::text, 'Cleaning'::text, 'Other'::text])));
alter table finance_expenses add constraint finance_expenses_amount_check CHECK ((amount >= (0)::numeric));
alter table finance_expenses add constraint finance_expenses_status_check CHECK ((status = ANY (ARRAY['Paid'::text, 'Pending'::text])));

CREATE INDEX idx_finance_expenses_category ON public.finance_expenses USING btree (category);
CREATE INDEX idx_finance_expenses_date ON public.finance_expenses USING btree (date);

alter table finance_expenses enable row level security;

create policy "Trustees can manage finance_expenses within their entities"
  on finance_expenses for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── FINANCE_INCOME ────────────────────────────────────────────────────────
create table if not exists finance_income (
  id uuid not null default gen_random_uuid(),
  date date not null,
  description text not null,
  amount numeric not null default 0,
  category text not null default 'Other'::text,
  reference text,
  notes text,
  status text not null default 'Confirmed'::text,
  source_type text,
  source_id uuid,
  created_at timestamp with time zone not null default now(),
  invoice_sent_at timestamp with time zone,
  invoice_paid_at timestamp with time zone,
  entity_id uuid
);

alter table finance_income add constraint finance_income_pkey PRIMARY KEY (id);
alter table finance_income add constraint finance_income_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;
alter table finance_income add constraint finance_income_amount_check CHECK ((amount >= (0)::numeric));
alter table finance_income add constraint finance_income_category_check CHECK ((category = ANY (ARRAY['Booking Income'::text, 'Grant Income'::text, 'Koha'::text, 'Hire Equipment'::text, 'Fundraiser'::text, 'Other'::text])));
alter table finance_income add constraint finance_income_status_check CHECK ((status = ANY (ARRAY['Confirmed'::text, 'Pending'::text])));

CREATE INDEX idx_finance_income_category ON public.finance_income USING btree (category);
CREATE INDEX idx_finance_income_date ON public.finance_income USING btree (date);
CREATE INDEX idx_finance_income_source ON public.finance_income USING btree (source_id);

alter table finance_income enable row level security;

create policy "Trustees can manage finance_income within their entities"
  on finance_income for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── FOUNDER_NOTES ─────────────────────────────────────────────────────────
create table if not exists founder_notes (
  marae_name text not null,
  step_key text not null,
  completed boolean not null default false,
  updated_at timestamp with time zone default now(),
  data jsonb
);

alter table founder_notes add constraint founder_notes_pkey PRIMARY KEY (marae_name, step_key);

alter table founder_notes enable row level security;

create policy "founder_notes: authenticated access"
  on founder_notes for all
  to authenticated
  using (true)
  with check (true);


-- ── GOAL_LINKS ────────────────────────────────────────────────────────────
create table if not exists goal_links (
  id uuid not null default gen_random_uuid(),
  goal_id uuid not null,
  link_type text not null,
  link_id uuid not null,
  created_at timestamp with time zone default now()
);

alter table goal_links add constraint goal_links_pkey PRIMARY KEY (id);
alter table goal_links add constraint goal_links_goal_id_link_type_link_id_key UNIQUE (goal_id, link_type, link_id);
alter table goal_links add constraint goal_links_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;
alter table goal_links add constraint goal_links_link_type_check CHECK ((link_type = ANY (ARRAY['project'::text, 'compliance_item'::text, 'grant'::text])));

alter table goal_links enable row level security;

create policy "allow_authenticated"
  on goal_links for all
  to authenticated
  using (true)
  with check (true);

create policy "goal_links: authenticated full access"
  on goal_links for all
  to authenticated
  using (true)
  with check (true);


-- ── GOALS ─────────────────────────────────────────────────────────────────
create table if not exists goals (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'governance'::text,
  start_date date,
  target_date date,
  status text not null default 'not_started'::text,
  progress integer not null default 0,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  responsible_name text,
  focus_area text not null,
  related_module text
);

alter table goals add constraint goals_pkey PRIMARY KEY (id);
alter table goals add constraint goals_progress_check CHECK (((progress >= 0) AND (progress <= 100)));
alter table goals add constraint goals_focus_area_check CHECK ((focus_area = ANY (ARRAY['Cultural'::text, 'Facilities'::text, 'Health & Wellbeing'::text, 'Rangatahi'::text, 'Taonga preservation'::text, 'General'::text])));
alter table goals add constraint goals_related_module_check CHECK (((related_module IS NULL) OR (related_module = ANY (ARRAY['Compliance'::text, 'Risk Register'::text, 'Finance'::text, 'Assets'::text, 'Bookings'::text, 'Grants'::text, 'Projects'::text, 'Contacts'::text, 'Documents'::text, 'Emergency Plan'::text]))));
alter table goals add constraint goals_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'at_risk'::text, 'completed'::text])));

alter table goals enable row level security;

create policy "allow_authenticated"
  on goals for all
  to authenticated
  using (true)
  with check (true);

create policy "goals: authenticated full access"
  on goals for all
  to authenticated
  using (true)
  with check (true);


-- ── GRANTS ────────────────────────────────────────────────────────────────
create table if not exists grants (
  id uuid not null default gen_random_uuid(),
  name text not null,
  funder text not null,
  amount numeric,
  category text,
  status text default 'researching'::text,
  deadline date,
  submitted_date date,
  decision_date date,
  reporting_date date,
  contact_name text,
  contact_email text,
  notes text,
  created_at timestamp without time zone default now(),
  owner text
);

alter table grants add constraint grants_pkey PRIMARY KEY (id);

alter table grants enable row level security;

create policy "Authenticated users can manage grants"
  on grants for all
  to authenticated
  using (true)
  with check (true);

create policy "allow_authenticated"
  on grants for all
  to authenticated
  using (true)
  with check (true);


-- ── INCIDENTS ─────────────────────────────────────────────────────────────
create table if not exists incidents (
  id uuid not null default gen_random_uuid(),
  incident_date date not null default CURRENT_DATE,
  title text not null,
  description text,
  location text,
  severity text not null default 'minor'::text,
  people_involved text,
  responsible_name text,
  action_taken text,
  follow_up_date date,
  resolved boolean not null default false,
  document_url text,
  document_name text,
  created_at timestamp with time zone not null default now()
);

alter table incidents add constraint incidents_pkey PRIMARY KEY (id);
alter table incidents add constraint incidents_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'serious'::text, 'critical'::text])));

alter table incidents enable row level security;

create policy "incidents: authenticated full access"
  on incidents for all
  to authenticated
  using (true)
  with check (true);


-- ── INTEREST_REGISTER ─────────────────────────────────────────────────────
create table if not exists interest_register (
  id uuid not null default gen_random_uuid(),
  trustee_name text not null,
  nature_of_interest text,
  related_matter text,
  date_declared date,
  status text not null default 'Active'::text,
  created_at timestamp with time zone default now(),
  entity_id uuid
);

alter table interest_register add constraint interest_register_pkey PRIMARY KEY (id);
alter table interest_register add constraint interest_register_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;

alter table interest_register enable row level security;

create policy "interest_register_delete"
  on interest_register for delete
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));

create policy "interest_register_insert"
  on interest_register for insert
  to authenticated
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));

create policy "interest_register_select"
  on interest_register for select
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));

create policy "interest_register_update"
  on interest_register for update
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── MARAE_SETTINGS ────────────────────────────────────────────────────────
create table if not exists marae_settings (
  id uuid not null default gen_random_uuid(),
  marae_name text default 'Te Marae o Tainui'::text,
  location text default 'Manurewa, Auckland'::text,
  iwi text,
  hapu text,
  phone text,
  email text,
  website text,
  updated_at timestamp without time zone default now(),
  use_xero boolean not null default false,
  automation_level text default 'assisted'::text,
  founder_metrics jsonb,
  onboarding_complete boolean default false,
  onboarding_step integer default 0,
  payment_details text,
  bank_csv_mapping jsonb,
  emergency_plan_supported_by text,
  emergency_plan_history text
);

alter table marae_settings add constraint marae_settings_pkey PRIMARY KEY (id);
alter table marae_settings add constraint marae_settings_automation_level_check CHECK ((automation_level = ANY (ARRAY['manual'::text, 'assisted'::text, 'automatic'::text])));

alter table marae_settings enable row level security;

create policy "allow_authenticated"
  on marae_settings for all
  to authenticated
  using (true)
  with check (true);


-- ── MEETING_ACTIONS ───────────────────────────────────────────────────────
create table if not exists meeting_actions (
  id uuid not null default gen_random_uuid(),
  meeting_id uuid not null,
  description text not null,
  assigned_to text,
  due_date date,
  status text default 'Open'::text,
  created_at timestamp without time zone default now(),
  last_reminded_at timestamp with time zone
);

alter table meeting_actions add constraint meeting_actions_pkey PRIMARY KEY (id);
alter table meeting_actions add constraint meeting_actions_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

alter table meeting_actions enable row level security;

create policy "meeting_actions_delete"
  on meeting_actions for delete
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));

create policy "meeting_actions_insert"
  on meeting_actions for insert
  to authenticated
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));

create policy "meeting_actions_select"
  on meeting_actions for select
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));

create policy "meeting_actions_update"
  on meeting_actions for update
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));


-- ── MEETINGS ──────────────────────────────────────────────────────────────
create table if not exists meetings (
  id uuid not null default gen_random_uuid(),
  title text not null,
  meeting_type text,
  meeting_date date,
  chairperson text,
  secretary text,
  attendees text,
  apologies text,
  minutes text,
  created_by text,
  created_at timestamp without time zone default now(),
  attachment_url text,
  attachment_name text,
  entity_id uuid
);

alter table meetings add constraint meetings_pkey PRIMARY KEY (id);
alter table meetings add constraint meetings_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;

alter table meetings enable row level security;

create policy "meetings_delete"
  on meetings for delete
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));

create policy "meetings_insert"
  on meetings for insert
  to authenticated
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));

create policy "meetings_select"
  on meetings for select
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));

create policy "meetings_update"
  on meetings for update
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── MODULE_KPI_SNAPSHOTS ──────────────────────────────────────────────────
create table if not exists module_kpi_snapshots (
  id uuid not null default gen_random_uuid(),
  snapshot_month date not null,
  compliance_pct integer not null,
  risk_pct integer not null,
  assets_pct integer not null,
  goals_pct integer not null,
  locked_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  net_assets numeric,
  total_assets numeric,
  total_liabilities numeric
);

alter table module_kpi_snapshots add constraint module_kpi_snapshots_pkey PRIMARY KEY (id);
alter table module_kpi_snapshots add constraint module_kpi_snapshots_snapshot_month_key UNIQUE (snapshot_month);

alter table module_kpi_snapshots enable row level security;

create policy "module_kpi_snapshots: authenticated read"
  on module_kpi_snapshots for select
  to authenticated
  using (true);


-- ── NOTICES ───────────────────────────────────────────────────────────────
create table if not exists notices (
  id uuid not null default gen_random_uuid(),
  title text not null,
  body text,
  category text,
  author text,
  created_at timestamp without time zone default now()
);

alter table notices add constraint notices_pkey PRIMARY KEY (id);

alter table notices enable row level security;

create policy "allow_authenticated"
  on notices for all
  to authenticated
  using (true)
  with check (true);


-- ── NOTIFICATION_LOG ──────────────────────────────────────────────────────
create table if not exists notification_log (
  id uuid not null default gen_random_uuid(),
  notification_type text not null,
  entity_id text not null,
  entity_key text,
  trustee_id uuid,
  sent_at timestamp with time zone not null default now()
);

alter table notification_log add constraint notification_log_pkey PRIMARY KEY (id);
alter table notification_log add constraint notification_log_trustee_id_fkey FOREIGN KEY (trustee_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_notification_log_lookup ON public.notification_log USING btree (notification_type, entity_id, trustee_id, sent_at DESC);

alter table notification_log enable row level security;

create policy "Service role full access to notification_log"
  on notification_log for all
  to public
  using (true)
  with check (true);


-- ── PROFILES ──────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid not null,
  full_name text,
  email text,
  role text default 'community'::text,
  iwi text,
  phone text,
  created_at timestamp without time zone default now(),
  notes text,
  notification_prefs jsonb not null default '{"goals": true, "grants": true, "actions": true, "bookings": true, "compliance": true}'::jsonb,
  trustee_role text default 'standard'::text,
  is_fire_warden boolean not null default false
);

alter table profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table profiles add constraint profiles_trustee_role_check CHECK ((trustee_role = ANY (ARRAY['standard'::text, 'admin'::text])));
alter table profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['trustee'::text, 'community'::text])));

alter table profiles enable row level security;

create policy "allow_authenticated"
  on profiles for all
  to authenticated
  using (true)
  with check (true);


-- ── PROJECTS ──────────────────────────────────────────────────────────────
create table if not exists projects (
  id uuid not null default gen_random_uuid(),
  name text,
  status text default 'planning'::text,
  progress integer default 0,
  lead text,
  due_date date,
  notes text,
  created_at timestamp without time zone default now(),
  subtasks jsonb default '[]'::jsonb
);

alter table projects add constraint projects_pkey PRIMARY KEY (id);
alter table projects add constraint projects_status_check CHECK ((status = ANY (ARRAY['planning'::text, 'active'::text, 'review'::text, 'completed'::text])));

alter table projects enable row level security;

create policy "allow_authenticated"
  on projects for all
  to authenticated
  using (true)
  with check (true);


-- ── RESOLUTIONS ───────────────────────────────────────────────────────────
create table if not exists resolutions (
  id uuid not null default gen_random_uuid(),
  meeting_id uuid not null,
  resolution_number text,
  description text not null,
  date_passed date,
  status text default 'Open'::text,
  notes text,
  created_at timestamp without time zone default now()
);

alter table resolutions add constraint resolutions_pkey PRIMARY KEY (id);
alter table resolutions add constraint resolutions_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

alter table resolutions enable row level security;

create policy "resolutions_delete"
  on resolutions for delete
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));

create policy "resolutions_insert"
  on resolutions for insert
  to authenticated
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));

create policy "resolutions_select"
  on resolutions for select
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));

create policy "resolutions_update"
  on resolutions for update
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));


-- ── RISK_REGISTER ─────────────────────────────────────────────────────────
create table if not exists risk_register (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  risk_description text not null,
  category text,
  likelihood text,
  consequence text,
  risk_rating text,
  controls text,
  owner text,
  review_date date,
  status text default 'Open'::text,
  notes text,
  entity_id uuid,
  trustee_id uuid
);

alter table risk_register add constraint risk_register_pkey PRIMARY KEY (id);
alter table risk_register add constraint risk_register_trustee_id_fkey FOREIGN KEY (trustee_id) REFERENCES auth.users(id);
alter table risk_register add constraint risk_register_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT;

alter table risk_register enable row level security;

create policy "Trustees can manage risk_register within their entities"
  on risk_register for all
  to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)))
  with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));


-- ── SERVICE_REMINDERS ─────────────────────────────────────────────────────
create table if not exists service_reminders (
  id uuid not null default gen_random_uuid(),
  asset_id uuid,
  type text not null,
  due_date date not null,
  recurring text default 'annual'::text,
  notes text,
  created_at timestamp with time zone default now(),
  auto_workflow_enabled boolean not null default false,
  owner text
);

alter table service_reminders add constraint service_reminders_pkey PRIMARY KEY (id);

alter table service_reminders enable row level security;

create policy "allow_authenticated"
  on service_reminders for all
  to authenticated
  using (true)
  with check (true);


-- ── SYSTEM_CHECK_LOG ──────────────────────────────────────────────────────
create table if not exists system_check_log (
  id uuid not null default gen_random_uuid(),
  check_name text not null,
  run_at timestamp with time zone not null default now(),
  findings_count integer not null default 0,
  details jsonb not null default '[]'::jsonb
);

alter table system_check_log add constraint system_check_log_pkey PRIMARY KEY (id);

alter table system_check_log enable row level security;

create policy "system_check_log: authenticated full access"
  on system_check_log for all
  to authenticated
  using (true)
  with check (true);


-- ── TASK_COMMENTS ─────────────────────────────────────────────────────────
create table if not exists task_comments (
  id uuid not null default gen_random_uuid(),
  task_id uuid not null,
  author_name text not null,
  author_email text,
  message text not null,
  created_at timestamp with time zone not null default now()
);

alter table task_comments add constraint task_comments_pkey PRIMARY KEY (id);
alter table task_comments add constraint task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

alter table task_comments enable row level security;

create policy "task_comments: authenticated full access"
  on task_comments for all
  to authenticated
  using (true)
  with check (true);


-- ── TASKS ─────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to text,
  due_date date,
  priority text default 'Medium'::text,
  status text default 'open'::text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  workflow_instance_id uuid,
  workflow_step_order integer,
  parent_task_id uuid
);

alter table tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table tasks add constraint tasks_workflow_instance_id_fkey FOREIGN KEY (workflow_instance_id) REFERENCES workflow_instances(id);
alter table tasks add constraint tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table tasks add constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['High'::text, 'Medium'::text, 'Low'::text])));
alter table tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in-progress'::text, 'completed'::text, 'cancelled'::text])));

CREATE INDEX idx_tasks_parent_task_id ON public.tasks USING btree (parent_task_id);
CREATE UNIQUE INDEX idx_tasks_unique_active_auto_title ON public.tasks USING btree (title) WHERE ((status = ANY (ARRAY['open'::text, 'in-progress'::text])) AND (title ~ '^(UPCOMING|OVERDUE|PROJECT|SERVICE|ACTION|GOAL|GRANT|FINANCE): '::text));

alter table tasks enable row level security;

create policy "allow_authenticated"
  on tasks for all
  to authenticated
  using (true)
  with check (true);


-- ── TRUSTEE_ENTITIES ──────────────────────────────────────────────────────
create table if not exists trustee_entities (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  entity_id uuid not null,
  assigned_at timestamp with time zone not null default now()
);

alter table trustee_entities add constraint trustee_entities_pkey PRIMARY KEY (id);
alter table trustee_entities add constraint trustee_entities_profile_id_entity_id_key UNIQUE (profile_id, entity_id);
alter table trustee_entities add constraint trustee_entities_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;
alter table trustee_entities add constraint trustee_entities_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table trustee_entities enable row level security;

create policy "Admin trustees manage assignments"
  on trustee_entities for all
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));

create policy "Trustees view own assignments, admins view all"
  on trustee_entities for select
  to authenticated
  using (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))));


-- ── WORKFLOW_INSTANCES ────────────────────────────────────────────────────
create table if not exists workflow_instances (
  id uuid not null default gen_random_uuid(),
  template_id uuid,
  name text not null,
  status text default 'active'::text,
  progress_pct integer default 0,
  entity_type text,
  entity_id uuid,
  due_date date,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  created_by uuid,
  entity_name text,
  trigger_type text,
  trigger_date date
);

alter table workflow_instances add constraint workflow_instances_pkey PRIMARY KEY (id);
alter table workflow_instances add constraint workflow_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES workflow_templates(id);
alter table workflow_instances add constraint workflow_instances_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table workflow_instances add constraint workflow_instances_status_check CHECK ((status = ANY (ARRAY['active'::text, 'complete'::text, 'cancelled'::text])));

alter table workflow_instances enable row level security;

create policy "authenticated users manage instances"
  on workflow_instances for all
  to public
  using ((auth.role() = 'authenticated'::text));

create policy "authenticated users view instances"
  on workflow_instances for select
  to public
  using ((auth.role() = 'authenticated'::text));


-- ── WORKFLOW_STEPS ────────────────────────────────────────────────────────
create table if not exists workflow_steps (
  id uuid not null default gen_random_uuid(),
  template_id uuid,
  step_order integer not null,
  title text not null,
  description text,
  requires_document boolean default false,
  document_label text,
  created_at timestamp with time zone default now()
);

alter table workflow_steps add constraint workflow_steps_pkey PRIMARY KEY (id);
alter table workflow_steps add constraint workflow_steps_template_id_fkey FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE;

alter table workflow_steps enable row level security;

create policy "authenticated users manage steps"
  on workflow_steps for all
  to public
  using ((auth.role() = 'authenticated'::text));

create policy "authenticated users view steps"
  on workflow_steps for select
  to public
  using ((auth.role() = 'authenticated'::text));


-- ── WORKFLOW_TEMPLATES ────────────────────────────────────────────────────
create table if not exists workflow_templates (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  category text default 'maintenance'::text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table workflow_templates add constraint workflow_templates_pkey PRIMARY KEY (id);

alter table workflow_templates enable row level security;

create policy "authenticated users manage templates"
  on workflow_templates for all
  to public
  using ((auth.role() = 'authenticated'::text));

create policy "authenticated users view templates"
  on workflow_templates for select
  to public
  using ((auth.role() = 'authenticated'::text));


-- ── XERO_CONNECTIONS ──────────────────────────────────────────────────────
create table if not exists xero_connections (
  id uuid not null default gen_random_uuid(),
  entity_id uuid,
  tenant_id text not null,
  tenant_name text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamp with time zone not null,
  scope text,
  connected_by uuid,
  status text not null default 'active'::text,
  connected_at timestamp with time zone not null default now(),
  last_refreshed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table xero_connections add constraint xero_connections_pkey PRIMARY KEY (id);
alter table xero_connections add constraint xero_connections_tenant_id_key UNIQUE (tenant_id);
alter table xero_connections add constraint xero_connections_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table xero_connections add constraint xero_connections_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX xero_connections_entity_unique ON public.xero_connections USING btree (entity_id) WHERE (entity_id IS NOT NULL);
CREATE UNIQUE INDEX xero_connections_whole_marae_unique ON public.xero_connections USING btree ((true)) WHERE (entity_id IS NULL);

alter table xero_connections enable row level security;


-- ──────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_cron_job_last_success(job_name_pattern text)
 RETURNS timestamp with time zone
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select max(jrd.start_time)
  from cron.job_run_details jrd
  join cron.job j on j.jobid = jrd.jobid
  where j.command like job_name_pattern
    and jrd.status = 'succeeded';
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_entities_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if (select count(*) from entities) >= 3 then
    raise exception 'A marae can have at most 3 entities.';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_orphaned_auth_users()
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select u.id, u.email, u.created_at, u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null;
$function$
;

CREATE OR REPLACE FUNCTION public.get_anon_granted_policies()
 RETURNS TABLE(table_name text, policy_name text, cmd text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public' and 'anon' = any(roles);
$function$
;

CREATE OR REPLACE FUNCTION public.get_meeting_entity_id(check_meeting_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select entity_id from meetings where id = check_meeting_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_schema_columns()
 RETURNS TABLE(table_name text, column_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.relname::text as table_name, a.attname::text as column_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname, a.attnum;
$function$
;

CREATE OR REPLACE FUNCTION public.get_security_definer_function_grants()
 RETURNS TABLE(function_name text, grantees text[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.proname::text, array_agg(distinct g.grantee::text order by g.grantee::text)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join information_schema.routine_privileges g
    on g.routine_name = p.proname and g.routine_schema = 'public'
  where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef = true
  group by p.proname;
$function$
;

CREATE OR REPLACE FUNCTION public.get_trustee_login_activity()
 RETURNS TABLE(id uuid, full_name text, email text, last_sign_in_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, u.email, u.last_sign_in_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'trustee'
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name, role, trustee_role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      initcap(replace(replace(split_part(new.email, '@', 1), '.', ' '), '_', ' '))
    ),
    'community',
    'standard'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_entity_member(check_entity_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select check_entity_id is null
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin')
    or exists (select 1 from trustee_entities te where te.profile_id = auth.uid() and te.entity_id = check_entity_id);
$function$
;

CREATE OR REPLACE FUNCTION public.issue_action_reminder_token(p_meeting_action_id uuid, p_trustee_id uuid, p_resolved_name text, p_resolved_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_token_id uuid;
begin
  update action_reminder_tokens
  set used_at = now()
  where meeting_action_id = p_meeting_action_id
    and used_at is null
    and expires_at > now();

  insert into action_reminder_tokens
    (meeting_action_id, trustee_id, resolved_name, resolved_email)
  values
    (p_meeting_action_id, p_trustee_id, p_resolved_name, p_resolved_email)
  returning id into v_token_id;

  return v_token_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.redeem_action_reminder_token(p_token uuid)
 RETURNS TABLE(meeting_action_id uuid, description text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_action_id uuid;
begin
  update action_reminder_tokens
  set used_at = now()
  where id = p_token
    and used_at is null
    and expires_at > now()
  returning action_reminder_tokens.meeting_action_id into v_action_id;

  if v_action_id is null then
    return;
  end if;

  update meeting_actions
  set status = 'Completed'
  where id = v_action_id
    and status is distinct from 'Completed';

  return query
    select ma.id, ma.description
    from meeting_actions ma
    where ma.id = v_action_id;
end;
$function$
;

-- ──────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER entities_limit_trigger BEFORE INSERT ON public.entities FOR EACH ROW EXECUTE FUNCTION enforce_entities_limit();

