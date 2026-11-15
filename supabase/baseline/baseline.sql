-- MaraeHub baseline: STRUCTURE ONLY, no data. GENERATED FILE: do not edit by hand.
-- Regenerate with: node scripts/generate-baseline-migration.js
-- Represents the reference project's structure up to migration 20261111191801.
-- Migrations newer than that are applied afterwards by scripts/apply-to-all.sh.

set check_function_bodies = off;

do $guard$ begin
  if (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') > 0 then
    raise exception 'REFUSING TO RUN: this project already has tables in the public schema. The baseline is for brand-new empty projects only.';
  end if;
end $guard$;

create extension if not exists "pg_cron";
create extension if not exists "pg_net";
create extension if not exists "pgcrypto";
create extension if not exists "supabase_vault";
create extension if not exists "uuid-ossp";

-- TABLES
create table if not exists public."action_reminder_tokens" (
  id uuid default gen_random_uuid() not null,
  meeting_action_id uuid not null,
  trustee_id uuid not null,
  resolved_name text not null,
  resolved_email text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '14 days'::interval) not null,
  used_at timestamp with time zone
);
create table if not exists public."assets" (
  id uuid default gen_random_uuid() not null,
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
  replacement_date date generated always as ((purchase_date + ((lifespan_years)::double precision * '1 year'::interval))) stored,
  inventory_category text,
  quantity integer,
  last_stocktake date,
  entity_id uuid,
  linked_document_id uuid
);
create table if not exists public."audit_log" (
  id uuid default gen_random_uuid() not null,
  entity_id uuid,
  user_id uuid not null,
  user_email text,
  action text not null,
  resource_type text not null,
  resource_id text,
  resource_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."backup_file_log" (
  bucket_id text not null,
  object_path text not null,
  version_key text not null,
  size_bytes bigint,
  copied_at timestamp with time zone default now() not null
);
create table if not exists public."backup_runs" (
  id uuid default gen_random_uuid() not null,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  status text default 'running'::text not null,
  files_scanned integer default 0 not null,
  files_copied integer default 0 not null,
  files_failed integer default 0 not null,
  bytes_copied bigint default 0 not null,
  note text
);
create table if not exists public."bank_reconciliations" (
  id uuid default gen_random_uuid() not null,
  filename text not null,
  statement_start_date date not null,
  statement_end_date date not null,
  reconciled_by text,
  reconciled_at timestamp with time zone default now() not null,
  matched_count integer default 0 not null,
  added_count integer default 0 not null,
  unresolved_count integer default 0 not null,
  rows jsonb default '[]'::jsonb not null
);
create table if not exists public."blocked_dates" (
  id uuid default gen_random_uuid() not null,
  from_date date not null,
  to_date date not null,
  reason text,
  created_at timestamp without time zone default now()
);
create table if not exists public."booking_checklists" (
  id uuid default gen_random_uuid() not null,
  booking_id uuid,
  items jsonb,
  completed_by text,
  completed_at timestamp without time zone,
  notes text,
  created_at timestamp without time zone default now(),
  completed boolean default false not null
);
create table if not exists public."booking_feedback" (
  id uuid default gen_random_uuid() not null,
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
create table if not exists public."bookings" (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  occasion text,
  start_date date,
  end_date date,
  guests integer,
  overnight boolean default false,
  facilities text[],
  iwi text,
  notes text,
  status text default 'pending'::text,
  reference text,
  created_at timestamp without time zone default now(),
  contact_name text,
  contact_phone text,
  contact_email text,
  entity_id uuid,
  organisation text
);
create table if not exists public."check_alert_state" (
  check_name text not null,
  last_alerted_at timestamp with time zone
);
create table if not exists public."checklist_templates" (
  id uuid default gen_random_uuid() not null,
  items jsonb,
  updated_at timestamp without time zone default now(),
  label text not null,
  sort_order integer default 0 not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."compliance_items" (
  id uuid default gen_random_uuid() not null,
  category text not null,
  name text not null,
  due_date date,
  renewal_months integer,
  responsible_name text,
  notes text,
  document_url text,
  document_name text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  last_checked_date date,
  entity_id uuid,
  classification text default 'task'::text not null,
  legal_basis text,
  legal_basis_detail text,
  workflow_template_id uuid,
  last_reminded_at timestamp with time zone,
  risk_prompt_dismissed_at timestamp with time zone,
  linked_service_reminder_id uuid,
  linked_document_id uuid,
  linked_expense_id uuid,
  stage smallint
);
create table if not exists public."contacts" (
  id uuid default gen_random_uuid() not null,
  full_name text not null,
  role text default 'community'::text,
  email text,
  phone text,
  notes text,
  created_at timestamp without time zone default now(),
  is_fire_warden boolean default false not null
);
create table if not exists public."contractors" (
  id uuid default gen_random_uuid() not null,
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
create table if not exists public."documents" (
  id uuid default gen_random_uuid() not null,
  title text not null,
  category text,
  notes text,
  file_name text,
  file_size bigint,
  file_type text,
  file_url text,
  created_at timestamp without time zone default now(),
  entity_id uuid,
  charter_fields jsonb,
  deleted_at timestamp with time zone,
  deleted_by uuid
);
create table if not exists public."emergency_building_plans" (
  id uuid default gen_random_uuid() not null,
  entity_id uuid,
  name text not null,
  image_path text,
  layout jsonb,
  notes text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."emergency_map_points" (
  id uuid default gen_random_uuid() not null,
  entity_id uuid,
  point_type text not null,
  label text not null,
  latitude numeric not null,
  longitude numeric not null,
  notes text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."emergency_plan_hazards" (
  id uuid default gen_random_uuid() not null,
  hazard_type text not null,
  likely_impact text,
  what_to_do text,
  entity_id uuid,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."emergency_plan_people" (
  id uuid default gen_random_uuid() not null,
  role_category text not null,
  full_name text not null,
  phone text,
  skill_type text,
  entity_id uuid,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."emergency_plan_pins" (
  id uuid default gen_random_uuid() not null,
  plan_id uuid not null,
  pin_type text not null,
  label text not null,
  x_pct numeric not null,
  y_pct numeric not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  asset_id uuid
);
create table if not exists public."emergency_response_events" (
  id uuid default gen_random_uuid() not null,
  entity_id uuid,
  event_date date not null,
  event_name text not null,
  description text not null,
  people_served integer,
  duration_days integer,
  document_url text,
  document_name text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."emergency_welfare_checks" (
  id uuid default gen_random_uuid() not null,
  full_name text not null,
  phone text,
  usual_location text,
  needs text[] default '{}'::text[] not null,
  notes text,
  checker_id uuid,
  last_checked date,
  consent_confirmed boolean default false not null,
  entity_id uuid,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."entities" (
  id uuid default gen_random_uuid() not null,
  name text not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."export_log" (
  id uuid default gen_random_uuid() not null,
  account_email text not null,
  export_type text not null,
  row_count integer not null,
  exported_at timestamp with time zone default now() not null
);
create table if not exists public."feedback" (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  user_name text,
  user_email text,
  type text,
  message text,
  page text,
  created_at timestamp without time zone default now(),
  marae text,
  rating text,
  status text default 'open'::text not null,
  resolved_at timestamp with time zone
);
create table if not exists public."finance_balance_sheet" (
  id uuid default gen_random_uuid() not null,
  cash_balance numeric(12,2) default 0 not null,
  other_assets numeric(12,2) default 0 not null,
  other_assets_notes text,
  loans numeric(12,2) default 0 not null,
  loans_notes text,
  outstanding_payments numeric(12,2) default 0 not null,
  outstanding_notes text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  term_deposits numeric default 0,
  shares_bonds numeric default 0,
  property_investments numeric default 0,
  other_investments numeric default 0,
  investments_notes text
);
create table if not exists public."finance_budgets" (
  id uuid default gen_random_uuid() not null,
  financial_year integer not null,
  category text not null,
  amount numeric(12,2) default 0 not null,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."finance_expenses" (
  id uuid default gen_random_uuid() not null,
  date date not null,
  description text not null,
  amount numeric(12,2) default 0 not null,
  category text default 'Other'::text not null,
  payee text,
  reference text,
  receipt_url text,
  receipt_name text,
  notes text,
  status text default 'Paid'::text not null,
  created_at timestamp with time zone default now() not null,
  entity_id uuid,
  gst_amount numeric
);
create table if not exists public."finance_income" (
  id uuid default gen_random_uuid() not null,
  date date not null,
  description text not null,
  amount numeric(12,2) default 0 not null,
  category text default 'Other'::text not null,
  reference text,
  notes text,
  status text default 'Confirmed'::text not null,
  source_type text,
  source_id uuid,
  created_at timestamp with time zone default now() not null,
  invoice_sent_at timestamp with time zone,
  invoice_paid_at timestamp with time zone,
  entity_id uuid,
  gst_amount numeric,
  payer text,
  receipt_url text,
  receipt_name text
);
create table if not exists public."finance_opening_balances" (
  id uuid default gen_random_uuid() not null,
  financial_year integer not null,
  opening_balance numeric default 0 not null,
  notes text,
  set_by text,
  set_at timestamp with time zone default now() not null
);
create table if not exists public."founder_metrics" (
  id uuid default gen_random_uuid() not null,
  data jsonb,
  updated_at timestamp with time zone default now()
);
create table if not exists public."founder_notes" (
  marae_name text not null,
  step_key text not null,
  completed boolean default false not null,
  updated_at timestamp with time zone default now(),
  data jsonb
);
create table if not exists public."gl_accounts" (
  id uuid default gen_random_uuid() not null,
  code integer not null,
  name text not null,
  account_type text not null,
  normal_balance text not null,
  description text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."gl_category_account_map" (
  id uuid default gen_random_uuid() not null,
  category text not null,
  module text not null,
  account_id uuid not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."gl_journal_entries" (
  id uuid default gen_random_uuid() not null,
  entry_date date not null,
  description text not null,
  source_table text,
  source_id uuid,
  entry_type text not null,
  voids_entry_id uuid,
  created_by text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."gl_journal_lines" (
  id uuid default gen_random_uuid() not null,
  journal_entry_id uuid not null,
  account_id uuid not null,
  debit numeric default 0 not null,
  credit numeric default 0 not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."goal_links" (
  id uuid default gen_random_uuid() not null,
  goal_id uuid not null,
  link_type text not null,
  link_id uuid not null,
  created_at timestamp with time zone default now()
);
create table if not exists public."goals" (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  category text default 'governance'::text not null,
  start_date date,
  target_date date,
  status text default 'not_started'::text not null,
  progress integer default 0 not null,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  responsible_name text,
  focus_area text not null,
  related_module text
);
create table if not exists public."google_calendar_connections" (
  id uuid default gen_random_uuid() not null,
  trustee_id uuid not null,
  google_email text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamp with time zone not null,
  scope text,
  status text default 'active'::text not null,
  connected_at timestamp with time zone default now() not null,
  last_refreshed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public."grants" (
  id uuid default gen_random_uuid() not null,
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
  owner text,
  source_url text
);
create table if not exists public."incidents" (
  id uuid default gen_random_uuid() not null,
  incident_date date default CURRENT_DATE not null,
  title text not null,
  description text,
  location text,
  severity text default 'minor'::text not null,
  people_involved text,
  responsible_name text,
  action_taken text,
  follow_up_date date,
  resolved boolean default false not null,
  document_url text,
  document_name text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."interest_register" (
  id uuid default gen_random_uuid() not null,
  trustee_name text not null,
  nature_of_interest text,
  related_matter text,
  date_declared date,
  status text default 'Active'::text not null,
  created_at timestamp with time zone default now(),
  entity_id uuid
);
create table if not exists public."login_attempts" (
  id uuid default gen_random_uuid() not null,
  email text not null,
  success boolean not null,
  attempted_at timestamp with time zone default now() not null
);
create table if not exists public."marae_settings" (
  id uuid default gen_random_uuid() not null,
  marae_name text default 'Te Marae o Tainui'::text,
  location text default 'Manurewa, Auckland'::text,
  iwi text,
  hapu text,
  phone text,
  email text,
  website text,
  updated_at timestamp without time zone default now(),
  use_xero boolean default false not null,
  automation_level text default 'assisted'::text,
  onboarding_complete boolean default false,
  onboarding_step integer default 0,
  payment_details text,
  bank_csv_mapping jsonb,
  emergency_plan_supported_by text,
  emergency_plan_history text,
  reminders_paused boolean default false not null,
  gst_registered boolean default false not null,
  latitude numeric,
  longitude numeric,
  ai_drafting_enabled boolean default false not null
);
create table if not exists public."meeting_actions" (
  id uuid default gen_random_uuid() not null,
  meeting_id uuid not null,
  description text not null,
  assigned_to text,
  due_date date,
  status text default 'Open'::text,
  created_at timestamp without time zone default now(),
  last_reminded_at timestamp with time zone,
  resolution_id uuid
);
create table if not exists public."meeting_calendar_syncs" (
  id uuid default gen_random_uuid() not null,
  meeting_id uuid not null,
  trustee_id uuid not null,
  google_event_id text not null,
  synced_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public."meetings" (
  id uuid default gen_random_uuid() not null,
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
create table if not exists public."module_kpi_snapshots" (
  id uuid default gen_random_uuid() not null,
  snapshot_month date not null,
  compliance_pct integer,
  risk_pct integer,
  assets_pct integer,
  goals_pct integer,
  locked_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  net_assets numeric(12,2),
  total_assets numeric(12,2),
  total_liabilities numeric(12,2),
  health_score integer
);
create table if not exists public."notices" (
  id uuid default gen_random_uuid() not null,
  title text not null,
  body text,
  category text,
  author text,
  created_at timestamp without time zone default now()
);
create table if not exists public."notification_log" (
  id uuid default gen_random_uuid() not null,
  notification_type text not null,
  entity_id text not null,
  entity_key text,
  trustee_id uuid,
  sent_at timestamp with time zone default now() not null
);
create table if not exists public."profiles" (
  id uuid not null,
  full_name text,
  email text,
  role text default 'community'::text,
  iwi text,
  phone text,
  created_at timestamp without time zone default now(),
  notes text,
  notification_prefs jsonb default '{"goals": true, "grants": true, "actions": true, "bookings": true, "compliance": true}'::jsonb not null,
  trustee_role text default 'standard'::text,
  is_fire_warden boolean default false not null,
  is_system_account boolean default false not null
);
create table if not exists public."projects" (
  id uuid default gen_random_uuid() not null,
  name text,
  status text default 'planning'::text,
  progress integer default 0,
  lead text,
  due_date date,
  notes text,
  created_at timestamp without time zone default now(),
  subtasks jsonb default '[]'::jsonb
);
create table if not exists public."resolutions" (
  id uuid default gen_random_uuid() not null,
  meeting_id uuid not null,
  resolution_number text,
  description text not null,
  date_passed date,
  status text default 'Open'::text,
  notes text,
  created_at timestamp without time zone default now(),
  linked_document_id uuid
);
create table if not exists public."risk_register" (
  id uuid default gen_random_uuid() not null,
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
  trustee_id uuid,
  compliance_item_id uuid,
  workflow_prompt_dismissed_at timestamp with time zone,
  asset_id uuid,
  last_reminded_at timestamp with time zone
);
create table if not exists public."role_configs" (
  role_key text not null,
  label text not null,
  icon text,
  is_active boolean default false not null,
  duties jsonb default '[]'::jsonb not null
);
create table if not exists public."service_reminders" (
  id uuid default gen_random_uuid() not null,
  asset_id uuid,
  type text not null,
  due_date date not null,
  recurring text default 'annual'::text,
  notes text,
  created_at timestamp with time zone default now(),
  auto_workflow_enabled boolean default false not null,
  owner text
);
create table if not exists public."stripe_webhook_events" (
  event_id text not null,
  event_type text not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."system_check_log" (
  id uuid default gen_random_uuid() not null,
  check_name text not null,
  run_at timestamp with time zone default now() not null,
  findings_count integer default 0 not null,
  details jsonb default '[]'::jsonb not null
);
create table if not exists public."task_comments" (
  id uuid default gen_random_uuid() not null,
  task_id uuid not null,
  author_name text not null,
  author_email text,
  message text not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public."tasks" (
  id uuid default gen_random_uuid() not null,
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
create table if not exists public."trustee_entities" (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null,
  entity_id uuid not null,
  assigned_at timestamp with time zone default now() not null
);
create table if not exists public."workflow_instances" (
  id uuid default gen_random_uuid() not null,
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
  trigger_date date,
  context_data jsonb
);
create table if not exists public."workflow_steps" (
  id uuid default gen_random_uuid() not null,
  template_id uuid,
  step_order integer not null,
  title text not null,
  description text,
  requires_document boolean default false,
  document_label text,
  created_at timestamp with time zone default now(),
  role_key text
);
create table if not exists public."workflow_templates" (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  category text default 'maintenance'::text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);
create table if not exists public."xero_connections" (
  id uuid default gen_random_uuid() not null,
  entity_id uuid,
  tenant_id text not null,
  tenant_name text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamp with time zone not null,
  scope text,
  connected_by uuid,
  status text default 'active'::text not null,
  connected_at timestamp with time zone default now() not null,
  last_refreshed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- CONSTRAINTS (primary keys and uniques first, foreign keys last)
do $c$ begin alter table public."action_reminder_tokens" add constraint "action_reminder_tokens_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."assets" add constraint "assets_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."audit_log" add constraint "audit_log_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."backup_file_log" add constraint "backup_file_log_pkey" PRIMARY KEY (bucket_id, object_path); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."backup_runs" add constraint "backup_runs_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."bank_reconciliations" add constraint "bank_reconciliations_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."blocked_dates" add constraint "blocked_dates_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_checklists" add constraint "booking_checklists_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_feedback" add constraint "booking_feedback_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."bookings" add constraint "bookings_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."check_alert_state" add constraint "check_alert_state_pkey" PRIMARY KEY (check_name); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."checklist_templates" add constraint "checklist_templates_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."contacts" add constraint "contacts_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."contractors" add constraint "contractors_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."documents" add constraint "documents_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_building_plans" add constraint "emergency_building_plans_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_map_points" add constraint "emergency_map_points_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_hazards" add constraint "emergency_plan_hazards_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_people" add constraint "emergency_plan_people_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_pins" add constraint "emergency_plan_pins_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_response_events" add constraint "emergency_response_events_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_welfare_checks" add constraint "emergency_welfare_checks_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."entities" add constraint "entities_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."export_log" add constraint "export_log_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."feedback" add constraint "feedback_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_balance_sheet" add constraint "finance_balance_sheet_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_budgets" add constraint "finance_budgets_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_expenses" add constraint "finance_expenses_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_income" add constraint "finance_income_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_opening_balances" add constraint "finance_opening_balances_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."founder_metrics" add constraint "founder_metrics_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."founder_notes" add constraint "founder_notes_pkey" PRIMARY KEY (marae_name, step_key); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_accounts" add constraint "gl_accounts_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_category_account_map" add constraint "gl_category_account_map_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_entries" add constraint "gl_journal_entries_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_lines" add constraint "gl_journal_lines_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goal_links" add constraint "goal_links_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goals" add constraint "goals_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."google_calendar_connections" add constraint "google_calendar_connections_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."grants" add constraint "grants_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."incidents" add constraint "incidents_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."interest_register" add constraint "interest_register_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."login_attempts" add constraint "login_attempts_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."marae_settings" add constraint "marae_settings_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meeting_actions" add constraint "meeting_actions_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meeting_calendar_syncs" add constraint "meeting_calendar_syncs_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meetings" add constraint "meetings_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."module_kpi_snapshots" add constraint "module_kpi_snapshots_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."notices" add constraint "notices_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."notification_log" add constraint "notification_log_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."projects" add constraint "projects_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."resolutions" add constraint "resolutions_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."risk_register" add constraint "risk_register_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."role_configs" add constraint "role_configs_pkey" PRIMARY KEY (role_key); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."service_reminders" add constraint "service_reminders_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."stripe_webhook_events" add constraint "stripe_webhook_events_pkey" PRIMARY KEY (event_id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."system_check_log" add constraint "system_check_log_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."task_comments" add constraint "task_comments_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."tasks" add constraint "tasks_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."trustee_entities" add constraint "trustee_entities_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_instances" add constraint "workflow_instances_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_steps" add constraint "workflow_steps_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_templates" add constraint "workflow_templates_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."xero_connections" add constraint "xero_connections_pkey" PRIMARY KEY (id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."bank_reconciliations" add constraint "bank_reconciliations_statement_key" UNIQUE (filename, statement_start_date, statement_end_date); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."entities" add constraint "entities_name_key" UNIQUE (name); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_budgets" add constraint "finance_budgets_financial_year_category_key" UNIQUE (financial_year, category); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_opening_balances" add constraint "finance_opening_balances_financial_year_key" UNIQUE (financial_year); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_accounts" add constraint "gl_accounts_code_key" UNIQUE (code); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_category_account_map" add constraint "gl_category_account_map_category_module_key" UNIQUE (category, module); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goal_links" add constraint "goal_links_goal_id_link_type_link_id_key" UNIQUE (goal_id, link_type, link_id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."google_calendar_connections" add constraint "google_calendar_connections_trustee_id_key" UNIQUE (trustee_id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meeting_calendar_syncs" add constraint "meeting_calendar_syncs_meeting_trustee_key" UNIQUE (meeting_id, trustee_id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."module_kpi_snapshots" add constraint "module_kpi_snapshots_snapshot_month_key" UNIQUE (snapshot_month); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."trustee_entities" add constraint "trustee_entities_profile_id_entity_id_key" UNIQUE (profile_id, entity_id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_steps" add constraint "workflow_steps_template_role_step_key" UNIQUE (template_id, role_key, step_order); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."xero_connections" add constraint "xero_connections_tenant_id_key" UNIQUE (tenant_id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."assets" add constraint "assets_category_check" CHECK ((category = ANY (ARRAY['Building'::text, 'Equipment'::text, 'Vehicle'::text, 'Technology'::text, 'Grounds'::text, 'Other'::text, 'Inventory'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."assets" add constraint "assets_condition_check" CHECK ((condition = ANY (ARRAY['excellent'::text, 'good'::text, 'fair'::text, 'poor'::text, 'critical'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."audit_log" add constraint "audit_log_action_check" CHECK ((action = ANY (ARRAY['view'::text, 'upload'::text, 'download'::text, 'create'::text, 'update'::text, 'delete'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."backup_runs" add constraint "backup_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'ok'::text, 'partial'::text, 'failed'::text, 'error'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_feedback" add constraint "booking_feedback_cleanliness_check" CHECK (((rating_cleanliness >= 1) AND (rating_cleanliness <= 5))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_feedback" add constraint "booking_feedback_facilities_check" CHECK (((rating_facilities >= 1) AND (rating_facilities <= 5))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_feedback" add constraint "booking_feedback_rating_check" CHECK (((rating_overall >= 1) AND (rating_overall <= 5))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."bookings" add constraint "bookings_organisation_len" CHECK (((organisation IS NULL) OR (char_length(organisation) <= 120))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."bookings" add constraint "bookings_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_category_check" CHECK ((category = ANY (ARRAY['building'::text, 'insurance'::text, 'trustee'::text, 'health_safety'::text, 'civil_defence'::text, 'other'::text, 'emergency_preparedness'::text, 'water'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_classification_check" CHECK ((classification = ANY (ARRAY['task'::text, 'template'::text, 'workflow'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_stage_check" CHECK (((stage IS NULL) OR (stage = ANY (ARRAY[1, 2, 3])))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_building_plans" add constraint "emergency_building_plans_has_content_check" CHECK (((image_path IS NOT NULL) OR (layout IS NOT NULL))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_building_plans" add constraint "emergency_building_plans_layout_is_array_check" CHECK (((layout IS NULL) OR (jsonb_typeof(layout) = 'array'::text))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_building_plans" add constraint "emergency_building_plans_name_check" CHECK ((length(btrim(name)) > 0)); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_map_points" add constraint "emergency_map_points_latitude_check" CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_map_points" add constraint "emergency_map_points_longitude_check" CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_map_points" add constraint "emergency_map_points_point_type_check" CHECK ((point_type = ANY (ARRAY['water_source'::text, 'muster_point'::text, 'key_asset'::text, 'other'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_hazards" add constraint "emergency_plan_hazards_hazard_type_check" CHECK ((hazard_type = ANY (ARRAY['Landslide'::text, 'Flood'::text, 'Earthquake'::text, 'Fire'::text, 'Storm'::text, 'Tsunami'::text, 'Volcano'::text, 'Pandemic'::text, 'Man-Made Hazard'::text, 'Water Contamination'::text, 'Drought / Water Shortage'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_people" add constraint "emergency_plan_people_role_category_check" CHECK ((role_category = ANY (ARRAY['marae_contact'::text, 'emergency_contact'::text, 'marae_operator'::text, 'first_aider'::text, 'specialised_skill'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_pins" add constraint "emergency_plan_pins_label_check" CHECK ((length(btrim(label)) > 0)); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_pins" add constraint "emergency_plan_pins_type_check" CHECK ((pin_type = ANY (ARRAY['first_aid'::text, 'defibrillator'::text, 'fire_extinguisher'::text, 'fire_alarm'::text, 'exit'::text, 'power_shutoff'::text, 'water_shutoff'::text, 'gas_shutoff'::text, 'assembly_point'::text, 'torch_radio'::text, 'generator'::text, 'key_box'::text, 'other'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_pins" add constraint "emergency_plan_pins_x_check" CHECK (((x_pct >= (0)::numeric) AND (x_pct <= (100)::numeric))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_pins" add constraint "emergency_plan_pins_y_check" CHECK (((y_pct >= (0)::numeric) AND (y_pct <= (100)::numeric))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_response_events" add constraint "emergency_response_events_duration_days_check" CHECK (((duration_days IS NULL) OR (duration_days >= 0))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_response_events" add constraint "emergency_response_events_people_served_check" CHECK (((people_served IS NULL) OR (people_served >= 0))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_welfare_checks" add constraint "emergency_welfare_checks_consent_check" CHECK ((consent_confirmed = true)); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_welfare_checks" add constraint "emergency_welfare_checks_needs_check" CHECK ((needs <@ ARRAY['mobility'::text, 'power_equipment'::text, 'medication'::text, 'lives_alone'::text, 'hearing_sight'::text, 'transport'::text, 'other'::text])); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."feedback" add constraint "feedback_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_expenses" add constraint "finance_expenses_amount_check" CHECK ((amount >= (0)::numeric)); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_expenses" add constraint "finance_expenses_category_check" CHECK ((category = ANY (ARRAY['Maintenance and Repairs'::text, 'Utilities'::text, 'Insurance'::text, 'Events'::text, 'Administration'::text, 'Wages'::text, 'Equipment'::text, 'Cleaning'::text, 'Other'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_expenses" add constraint "finance_expenses_gst_amount_check" CHECK (((gst_amount IS NULL) OR ((gst_amount >= (0)::numeric) AND (gst_amount <= amount)))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_expenses" add constraint "finance_expenses_status_check" CHECK ((status = ANY (ARRAY['Paid'::text, 'Pending'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_income" add constraint "finance_income_amount_check" CHECK ((amount >= (0)::numeric)); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_income" add constraint "finance_income_category_check" CHECK ((category = ANY (ARRAY['Booking Income'::text, 'Grant Income'::text, 'Koha'::text, 'Hire Equipment'::text, 'Fundraiser'::text, 'Other'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_income" add constraint "finance_income_gst_amount_check" CHECK (((gst_amount IS NULL) OR ((gst_amount >= (0)::numeric) AND (gst_amount <= amount)))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_income" add constraint "finance_income_status_check" CHECK ((status = ANY (ARRAY['Confirmed'::text, 'Pending'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_accounts" add constraint "gl_accounts_account_type_check" CHECK ((account_type = ANY (ARRAY['Revenue'::text, 'Expense'::text, 'Asset'::text, 'Liability'::text, 'Equity'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_accounts" add constraint "gl_accounts_code_range_check" CHECK ((((account_type = 'Revenue'::text) AND ((code >= 200) AND (code <= 299))) OR ((account_type = 'Expense'::text) AND ((code >= 300) AND (code <= 499))) OR ((account_type = 'Asset'::text) AND ((code >= 600) AND (code <= 799))) OR ((account_type = 'Liability'::text) AND ((code >= 800) AND (code <= 899))) OR ((account_type = 'Equity'::text) AND ((code >= 900) AND (code <= 999))))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_accounts" add constraint "gl_accounts_normal_balance_check" CHECK ((normal_balance =
CASE
    WHEN (account_type = ANY (ARRAY['Asset'::text, 'Expense'::text])) THEN 'Debit'::text
    ELSE 'Credit'::text
END)); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_category_account_map" add constraint "gl_category_account_map_module_check" CHECK ((module = ANY (ARRAY['income'::text, 'expense'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_entries" add constraint "gl_journal_entries_entry_type_check" CHECK ((entry_type = ANY (ARRAY['recognition'::text, 'clearing'::text, 'void'::text, 'manual'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_entries" add constraint "gl_journal_entries_source_table_check" CHECK (((source_table IS NULL) OR (source_table = ANY (ARRAY['finance_income'::text, 'finance_expenses'::text])))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_lines" add constraint "gl_journal_lines_debit_credit_check" CHECK (((debit >= (0)::numeric) AND (credit >= (0)::numeric) AND (((debit > (0)::numeric) AND (credit = (0)::numeric)) OR ((credit > (0)::numeric) AND (debit = (0)::numeric))))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goal_links" add constraint "goal_links_link_type_check" CHECK ((link_type = ANY (ARRAY['project'::text, 'compliance_item'::text, 'grant'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goals" add constraint "goals_focus_area_check" CHECK ((focus_area = ANY (ARRAY['Cultural'::text, 'Facilities'::text, 'Health & Wellbeing'::text, 'Rangatahi'::text, 'Taonga preservation'::text, 'General'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goals" add constraint "goals_progress_check" CHECK (((progress >= 0) AND (progress <= 100))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goals" add constraint "goals_related_module_check" CHECK (((related_module IS NULL) OR (related_module = ANY (ARRAY['Compliance'::text, 'Risk Register'::text, 'Finance'::text, 'Assets'::text, 'Bookings'::text, 'Grants'::text, 'Projects'::text, 'Contacts'::text, 'Documents'::text, 'Emergency Plan'::text])))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goals" add constraint "goals_status_check" CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'at_risk'::text, 'completed'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."incidents" add constraint "incidents_severity_check" CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'serious'::text, 'critical'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."marae_settings" add constraint "marae_settings_automation_level_check" CHECK ((automation_level = ANY (ARRAY['manual'::text, 'assisted'::text, 'automatic'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."marae_settings" add constraint "marae_settings_latitude_check" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."marae_settings" add constraint "marae_settings_longitude_check" CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['trustee'::text, 'community'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."profiles" add constraint "profiles_trustee_role_check" CHECK ((trustee_role = ANY (ARRAY['standard'::text, 'admin'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."projects" add constraint "projects_status_check" CHECK ((status = ANY (ARRAY['planning'::text, 'active'::text, 'review'::text, 'completed'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."tasks" add constraint "tasks_priority_check" CHECK ((priority = ANY (ARRAY['High'::text, 'Medium'::text, 'Low'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."tasks" add constraint "tasks_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in-progress'::text, 'completed'::text, 'cancelled'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_instances" add constraint "workflow_instances_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'complete'::text, 'cancelled'::text]))); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."action_reminder_tokens" add constraint "action_reminder_tokens_meeting_action_id_fkey" FOREIGN KEY (meeting_action_id) REFERENCES meeting_actions(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."action_reminder_tokens" add constraint "action_reminder_tokens_trustee_id_fkey" FOREIGN KEY (trustee_id) REFERENCES profiles(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."assets" add constraint "assets_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."assets" add constraint "assets_linked_document_id_fkey" FOREIGN KEY (linked_document_id) REFERENCES documents(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_checklists" add constraint "booking_checklists_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_feedback" add constraint "booking_feedback_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."booking_feedback" add constraint "booking_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."bookings" add constraint "bookings_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."bookings" add constraint "bookings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_linked_document_id_fkey" FOREIGN KEY (linked_document_id) REFERENCES documents(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_linked_expense_id_fkey" FOREIGN KEY (linked_expense_id) REFERENCES finance_expenses(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_linked_service_reminder_id_fkey" FOREIGN KEY (linked_service_reminder_id) REFERENCES service_reminders(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."compliance_items" add constraint "compliance_items_workflow_template_id_fkey" FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."documents" add constraint "documents_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."documents" add constraint "documents_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_building_plans" add constraint "emergency_building_plans_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_map_points" add constraint "emergency_map_points_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_hazards" add constraint "emergency_plan_hazards_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_people" add constraint "emergency_plan_people_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_pins" add constraint "emergency_plan_pins_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_plan_pins" add constraint "emergency_plan_pins_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES emergency_building_plans(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_response_events" add constraint "emergency_response_events_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_welfare_checks" add constraint "emergency_welfare_checks_checker_id_fkey" FOREIGN KEY (checker_id) REFERENCES emergency_plan_people(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."emergency_welfare_checks" add constraint "emergency_welfare_checks_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_expenses" add constraint "finance_expenses_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."finance_income" add constraint "finance_income_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_category_account_map" add constraint "gl_category_account_map_account_id_fkey" FOREIGN KEY (account_id) REFERENCES gl_accounts(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_entries" add constraint "gl_journal_entries_voids_entry_id_fkey" FOREIGN KEY (voids_entry_id) REFERENCES gl_journal_entries(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_lines" add constraint "gl_journal_lines_account_id_fkey" FOREIGN KEY (account_id) REFERENCES gl_accounts(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."gl_journal_lines" add constraint "gl_journal_lines_journal_entry_id_fkey" FOREIGN KEY (journal_entry_id) REFERENCES gl_journal_entries(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."goal_links" add constraint "goal_links_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."google_calendar_connections" add constraint "google_calendar_connections_trustee_id_fkey" FOREIGN KEY (trustee_id) REFERENCES profiles(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."interest_register" add constraint "interest_register_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meeting_actions" add constraint "meeting_actions_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meeting_actions" add constraint "meeting_actions_resolution_id_fkey" FOREIGN KEY (resolution_id) REFERENCES resolutions(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meeting_calendar_syncs" add constraint "meeting_calendar_syncs_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meeting_calendar_syncs" add constraint "meeting_calendar_syncs_trustee_id_fkey" FOREIGN KEY (trustee_id) REFERENCES profiles(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."meetings" add constraint "meetings_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."notification_log" add constraint "notification_log_trustee_id_fkey" FOREIGN KEY (trustee_id) REFERENCES profiles(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."resolutions" add constraint "resolutions_linked_document_id_fkey" FOREIGN KEY (linked_document_id) REFERENCES documents(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."resolutions" add constraint "resolutions_meeting_id_fkey" FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."risk_register" add constraint "risk_register_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."risk_register" add constraint "risk_register_compliance_item_id_fkey" FOREIGN KEY (compliance_item_id) REFERENCES compliance_items(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."risk_register" add constraint "risk_register_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE RESTRICT; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."risk_register" add constraint "risk_register_trustee_id_fkey" FOREIGN KEY (trustee_id) REFERENCES auth.users(id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."service_reminders" add constraint "service_reminders_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."task_comments" add constraint "task_comments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."tasks" add constraint "tasks_parent_task_id_fkey" FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."tasks" add constraint "tasks_workflow_instance_id_fkey" FOREIGN KEY (workflow_instance_id) REFERENCES workflow_instances(id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."trustee_entities" add constraint "trustee_entities_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."trustee_entities" add constraint "trustee_entities_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_instances" add constraint "workflow_instances_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_instances" add constraint "workflow_instances_template_id_fkey" FOREIGN KEY (template_id) REFERENCES workflow_templates(id); exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."workflow_steps" add constraint "workflow_steps_template_id_fkey" FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."xero_connections" add constraint "xero_connections_connected_by_fkey" FOREIGN KEY (connected_by) REFERENCES profiles(id) ON DELETE SET NULL; exception when duplicate_object or duplicate_table then null; end $c$;
do $c$ begin alter table public."xero_connections" add constraint "xero_connections_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE; exception when duplicate_object or duplicate_table then null; end $c$;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_action_reminder_tokens_meeting_action_id ON public.action_reminder_tokens USING btree (meeting_action_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_id_idx ON public.audit_log USING btree (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON public.audit_log USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx ON public.documents USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS emergency_plan_pins_plan_id_idx ON public.emergency_plan_pins USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_emergency_response_events_date ON public.emergency_response_events USING btree (event_date);
CREATE INDEX IF NOT EXISTS export_log_account_email_exported_at_idx ON public.export_log USING btree (account_email, exported_at);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_fy ON public.finance_budgets USING btree (financial_year);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON public.finance_expenses USING btree (category);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_date ON public.finance_expenses USING btree (date);
CREATE INDEX IF NOT EXISTS idx_finance_income_category ON public.finance_income USING btree (category);
CREATE INDEX IF NOT EXISTS idx_finance_income_date ON public.finance_income USING btree (date);
CREATE INDEX IF NOT EXISTS idx_finance_income_source ON public.finance_income USING btree (source_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_account_type ON public.gl_accounts USING btree (account_type);
CREATE INDEX IF NOT EXISTS idx_gl_journal_entries_date ON public.gl_journal_entries USING btree (entry_date);
CREATE INDEX IF NOT EXISTS idx_gl_journal_entries_source ON public.gl_journal_entries USING btree (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_account ON public.gl_journal_lines USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_entry ON public.gl_journal_lines USING btree (journal_entry_id);
CREATE INDEX IF NOT EXISTS login_attempts_email_attempted_at_idx ON public.login_attempts USING btree (email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_notification_log_lookup ON public.notification_log USING btree (notification_type, entity_id, trustee_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks USING btree (parent_task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_unique_active_auto_title ON public.tasks USING btree (title) WHERE ((status = ANY (ARRAY['open'::text, 'in-progress'::text])) AND (title ~ '^(UPCOMING|OVERDUE|PROJECT|SERVICE|ACTION|GOAL|GRANT|FINANCE): '::text));
CREATE UNIQUE INDEX IF NOT EXISTS xero_connections_entity_unique ON public.xero_connections USING btree (entity_id) WHERE (entity_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS xero_connections_whole_marae_unique ON public.xero_connections USING btree ((true)) WHERE (entity_id IS NULL);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.check_column_generated(p_table text, p_column text)
 RETURNS TABLE(is_generated boolean, generation_expression text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (c.is_generated = 'ALWAYS'), c.generation_expression
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table and c.column_name = p_column;
$function$
;

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

CREATE OR REPLACE FUNCTION public.check_journal_lines_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT journal_entry_id, count(*) AS n, sum(debit) - sum(credit) AS diff
    FROM new_lines
    GROUP BY journal_entry_id
  LOOP
    IF r.n < 2 THEN
      RAISE EXCEPTION 'Journal entry % must have at least 2 lines in one insert (got %)', r.journal_entry_id, r.n;
    END IF;
    IF abs(r.diff) > 0.01 THEN
      RAISE EXCEPTION 'Journal entry % does not balance: debit-credit diff = %', r.journal_entry_id, r.diff;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.close_linked_task(p_source_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update tasks
  set status = 'completed', completed_at = now()
  where description like '%[source_id:' || p_source_id || ']%'
    and status in ('open', 'in-progress');
end;
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

CREATE OR REPLACE FUNCTION public.find_never_logged_in_trustees()
 RETURNS TABLE(id uuid, full_name text, email text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.full_name, u.email, u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'trustee'
    and p.is_system_account = false
    and u.last_sign_in_at is null;
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

CREATE OR REPLACE FUNCTION public.get_finance_health_score()
 RETURNS TABLE(has_enough_data boolean, score integer, status text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_fy_year   int;
  v_fy_from   date;
  v_fy_to     date;
  v_income    numeric;
  v_expenses  numeric;
  v_net       numeric;
  v_record_count int;
  v_score     int := 0;
  v_status    text := 'surplus';
begin
  if not exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee') then
    raise exception 'Trustee access required';
  end if;

  v_fy_year := case when extract(month from (now() at time zone 'Pacific/Auckland')) >= 4
                    then extract(year from (now() at time zone 'Pacific/Auckland'))::int
                    else extract(year from (now() at time zone 'Pacific/Auckland'))::int - 1
               end;
  v_fy_from := make_date(v_fy_year, 4, 1);
  v_fy_to   := make_date(v_fy_year + 1, 3, 31);

  select coalesce(sum(amount), 0) into v_income
    from finance_income where date >= v_fy_from and date <= v_fy_to;

  select coalesce(sum(amount), 0) into v_expenses
    from finance_expenses where date >= v_fy_from and date <= v_fy_to;

  select count(*) into v_record_count from (
    select amount from finance_income   where date >= v_fy_from and date <= v_fy_to and amount <> 0
    union all
    select amount from finance_expenses where date >= v_fy_from and date <= v_fy_to and amount <> 0
  ) t;

  v_net := v_income - v_expenses;

  if v_net >= 0 then
    v_score := 20; v_status := 'surplus';
  elsif v_income > 0 and abs(v_net) < v_income * 0.1 then
    v_score := 10; v_status := 'near_breakeven_deficit';
  else
    v_score := 0; v_status := 'deficit';
  end if;

  return query select (v_record_count >= 3), v_score, v_status;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_marae_display()
 RETURNS TABLE(marae_name text, location text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.marae_name, s.location from public.marae_settings s limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_meeting_entity_id(check_meeting_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
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

CREATE OR REPLACE FUNCTION public.get_schema_migrations_versions()
 RETURNS TABLE(version text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select version::text from supabase_migrations.schema_migrations order by version;
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

CREATE OR REPLACE FUNCTION public.get_storage_buckets()
 RETURNS TABLE(id text, name text, public boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, name, public from storage.buckets order by id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_storage_security_posture()
 RETURNS TABLE(kind text, name text, cmd text, roles text[], is_public boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'policy'::text, policyname, cmd, roles::text[], null::boolean
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
  union all
  select 'bucket'::text, id, null::text, null::text[], public
  from storage.buckets;
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

CREATE OR REPLACE FUNCTION public.get_unavailable_dates(p_exclude_booking uuid DEFAULT NULL::uuid)
 RETURNS TABLE(from_date date, to_date date, kind text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.start_date, coalesce(b.end_date, b.start_date), 'booked'::text
    from public.bookings b
   where b.status = 'approved'
     and b.start_date is not null
     and (p_exclude_booking is null or b.id <> p_exclude_booking)
  union all
  select d.from_date, d.to_date, 'blocked'::text
    from public.blocked_dates d
   where d.from_date is not null and d.to_date is not null;
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
 SET search_path TO 'public'
AS $function$
  SELECT check_entity_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'trustee' AND profiles.trustee_role = 'admin')
    OR EXISTS (SELECT 1 FROM trustee_entities te WHERE te.profile_id = auth.uid() AND te.entity_id = check_entity_id);
$function$
;

CREATE OR REPLACE FUNCTION public.is_founder()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(auth.jwt() ->> 'email', '') = ANY (ARRAY['johnaw9@gmail.com', 'waj@maraehub.co.nz']);
$function$
;

CREATE OR REPLACE FUNCTION public.is_trustee()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'trustee'
  );
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

CREATE OR REPLACE FUNCTION public.profiles_protect_permission_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.trustee_role IS DISTINCT FROM OLD.trustee_role)
     AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'You cannot change your own role or trustee_role.';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_booking_trustee_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and not public.is_trustee() then
    if new.user_id    is distinct from old.user_id
       or new.reference  is distinct from old.reference
       or new.entity_id  is distinct from old.entity_id
       or new.created_at is distinct from old.created_at then
      raise exception 'These booking fields can only be changed by a trustee'
        using errcode = '42501';
    end if;
  end if;
  return new;
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

  perform close_linked_task(v_action_id);

  return query
    select ma.id, ma.description
    from meeting_actions ma
    where ma.id = v_action_id;
end;
$function$
;

-- VIEWS
create or replace view public."xero_connection_status" with (security_invoker=true) as
 SELECT entity_id,
    tenant_name,
    status,
    connected_at,
    last_refreshed_at
   FROM xero_connections;

-- TRIGGERS
drop trigger if exists "on_auth_user_created" on auth."users";
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
drop trigger if exists "protect_booking_trustee_fields" on public."bookings";
CREATE TRIGGER protect_booking_trustee_fields BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.protect_booking_trustee_fields();
drop trigger if exists "entities_limit_trigger" on public."entities";
CREATE TRIGGER entities_limit_trigger BEFORE INSERT ON public.entities FOR EACH ROW EXECUTE FUNCTION public.enforce_entities_limit();
drop trigger if exists "trg_check_journal_lines_balance" on public."gl_journal_lines";
CREATE TRIGGER trg_check_journal_lines_balance AFTER INSERT ON public.gl_journal_lines REFERENCING NEW TABLE AS new_lines FOR EACH STATEMENT EXECUTE FUNCTION public.check_journal_lines_balance();
drop trigger if exists "protect_profiles_permission_fields" on public."profiles";
CREATE TRIGGER protect_profiles_permission_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_permission_fields();

-- ROW LEVEL SECURITY
alter table public."action_reminder_tokens" enable row level security;
alter table public."assets" enable row level security;
alter table public."audit_log" enable row level security;
alter table public."backup_file_log" enable row level security;
alter table public."backup_runs" enable row level security;
alter table public."bank_reconciliations" enable row level security;
alter table public."blocked_dates" enable row level security;
alter table public."booking_checklists" enable row level security;
alter table public."booking_feedback" enable row level security;
alter table public."bookings" enable row level security;
alter table public."check_alert_state" enable row level security;
alter table public."checklist_templates" enable row level security;
alter table public."compliance_items" enable row level security;
alter table public."contacts" enable row level security;
alter table public."contractors" enable row level security;
alter table public."documents" enable row level security;
alter table public."emergency_building_plans" enable row level security;
alter table public."emergency_map_points" enable row level security;
alter table public."emergency_plan_hazards" enable row level security;
alter table public."emergency_plan_people" enable row level security;
alter table public."emergency_plan_pins" enable row level security;
alter table public."emergency_response_events" enable row level security;
alter table public."emergency_welfare_checks" enable row level security;
alter table public."entities" enable row level security;
alter table public."export_log" enable row level security;
alter table public."feedback" enable row level security;
alter table public."finance_balance_sheet" enable row level security;
alter table public."finance_budgets" enable row level security;
alter table public."finance_expenses" enable row level security;
alter table public."finance_income" enable row level security;
alter table public."finance_opening_balances" enable row level security;
alter table public."founder_metrics" enable row level security;
alter table public."founder_notes" enable row level security;
alter table public."gl_accounts" enable row level security;
alter table public."gl_category_account_map" enable row level security;
alter table public."gl_journal_entries" enable row level security;
alter table public."gl_journal_lines" enable row level security;
alter table public."goal_links" enable row level security;
alter table public."goals" enable row level security;
alter table public."google_calendar_connections" enable row level security;
alter table public."grants" enable row level security;
alter table public."incidents" enable row level security;
alter table public."interest_register" enable row level security;
alter table public."login_attempts" enable row level security;
alter table public."marae_settings" enable row level security;
alter table public."meeting_actions" enable row level security;
alter table public."meeting_calendar_syncs" enable row level security;
alter table public."meetings" enable row level security;
alter table public."module_kpi_snapshots" enable row level security;
alter table public."notices" enable row level security;
alter table public."notification_log" enable row level security;
alter table public."profiles" enable row level security;
alter table public."projects" enable row level security;
alter table public."resolutions" enable row level security;
alter table public."risk_register" enable row level security;
alter table public."role_configs" enable row level security;
alter table public."service_reminders" enable row level security;
alter table public."stripe_webhook_events" enable row level security;
alter table public."system_check_log" enable row level security;
alter table public."task_comments" enable row level security;
alter table public."tasks" enable row level security;
alter table public."trustee_entities" enable row level security;
alter table public."workflow_instances" enable row level security;
alter table public."workflow_steps" enable row level security;
alter table public."workflow_templates" enable row level security;
alter table public."xero_connections" enable row level security;
drop policy if exists "action_reminder_tokens: own row only" on public."action_reminder_tokens";
create policy "action_reminder_tokens: own row only" on public."action_reminder_tokens" as permissive for all to authenticated using ((trustee_id = auth.uid())) with check ((trustee_id = auth.uid()));
drop policy if exists "trustees read own reminder tokens" on public."action_reminder_tokens";
create policy "trustees read own reminder tokens" on public."action_reminder_tokens" as permissive for select to authenticated using ((trustee_id = auth.uid()));
drop policy if exists "Trustees can manage assets within their entities" on public."assets";
create policy "Trustees can manage assets within their entities" on public."assets" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "authenticated_insert_audit_log" on public."audit_log";
create policy "authenticated_insert_audit_log" on public."audit_log" as permissive for insert to public with check (((auth.uid() = user_id) AND ((entity_id IS NULL) OR is_entity_member(entity_id))));
drop policy if exists "trustees_read_own_entity_audit_log" on public."audit_log";
create policy "trustees_read_own_entity_audit_log" on public."audit_log" as permissive for select to public using (((entity_id IS NULL) OR is_entity_member(entity_id)));
drop policy if exists "bank_reconciliations: admin trustees only" on public."bank_reconciliations";
create policy "bank_reconciliations: admin trustees only" on public."bank_reconciliations" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "blocked_dates: trustees only" on public."blocked_dates";
create policy "blocked_dates: trustees only" on public."blocked_dates" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "booking_checklists: trustees within entity" on public."booking_checklists";
create policy "booking_checklists: trustees within entity" on public."booking_checklists" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_checklists.booking_id) AND is_entity_member(b.entity_id)))))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_checklists.booking_id) AND is_entity_member(b.entity_id))))));
drop policy if exists "booking_feedback: hirers insert own, trustees read within entit" on public."booking_feedback";
create policy "booking_feedback: hirers insert own, trustees read within entit" on public."booking_feedback" as permissive for insert to authenticated with check ((user_id = auth.uid()));
drop policy if exists "booking_feedback: trustees read within entity" on public."booking_feedback";
create policy "booking_feedback: trustees read within entity" on public."booking_feedback" as permissive for select to authenticated using (((user_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = booking_feedback.booking_id) AND is_entity_member(b.entity_id)))))));
drop policy if exists "bookings: member delete own pending" on public."bookings";
create policy "bookings: member delete own pending" on public."bookings" as permissive for delete to authenticated using (((user_id = auth.uid()) AND (status = 'pending'::text)));
drop policy if exists "bookings: member insert own pending" on public."bookings";
create policy "bookings: member insert own pending" on public."bookings" as permissive for insert to authenticated with check (((user_id = auth.uid()) AND (status = 'pending'::text)));
drop policy if exists "bookings: member read own" on public."bookings";
create policy "bookings: member read own" on public."bookings" as permissive for select to authenticated using ((user_id = auth.uid()));
drop policy if exists "bookings: member update own" on public."bookings";
create policy "bookings: member update own" on public."bookings" as permissive for update to authenticated using (((user_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'approved'::text])))) with check (((user_id = auth.uid()) AND (status = 'pending'::text)));
drop policy if exists "bookings: trustees within entity" on public."bookings";
create policy "bookings: trustees within entity" on public."bookings" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "check_alert_state: founder only" on public."check_alert_state";
create policy "check_alert_state: founder only" on public."check_alert_state" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "checklist_templates: founder manages" on public."checklist_templates";
create policy "checklist_templates: founder manages" on public."checklist_templates" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "checklist_templates: trustees read" on public."checklist_templates";
create policy "checklist_templates: trustees read" on public."checklist_templates" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "Trustees can manage compliance_items within their entities" on public."compliance_items";
create policy "Trustees can manage compliance_items within their entities" on public."compliance_items" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "contacts: trustees only" on public."contacts";
create policy "contacts: trustees only" on public."contacts" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "contractors: trustees only" on public."contractors";
create policy "contractors: trustees only" on public."contractors" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "Trustees can manage documents within their entities" on public."documents";
create policy "Trustees can manage documents within their entities" on public."documents" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Trustees can manage building plans within their entities" on public."emergency_building_plans";
create policy "Trustees can manage building plans within their entities" on public."emergency_building_plans" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Trustees can manage emergency map points within their entities" on public."emergency_map_points";
create policy "Trustees can manage emergency map points within their entities" on public."emergency_map_points" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Trustees can manage emergency plan hazards within their entitie" on public."emergency_plan_hazards";
create policy "Trustees can manage emergency plan hazards within their entitie" on public."emergency_plan_hazards" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Trustees can manage emergency plan people within their entities" on public."emergency_plan_people";
create policy "Trustees can manage emergency plan people within their entities" on public."emergency_plan_people" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Trustees can manage plan pins within their entities" on public."emergency_plan_pins";
create policy "Trustees can manage plan pins within their entities" on public."emergency_plan_pins" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND (EXISTS ( SELECT 1
   FROM emergency_building_plans p
  WHERE ((p.id = emergency_plan_pins.plan_id) AND is_entity_member(p.entity_id)))))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND (EXISTS ( SELECT 1
   FROM emergency_building_plans p
  WHERE ((p.id = emergency_plan_pins.plan_id) AND is_entity_member(p.entity_id))))));
drop policy if exists "Trustees can manage emergency response events within their enti" on public."emergency_response_events";
create policy "Trustees can manage emergency response events within their enti" on public."emergency_response_events" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Trustees can manage welfare checks within their entities" on public."emergency_welfare_checks";
create policy "Trustees can manage welfare checks within their entities" on public."emergency_welfare_checks" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Trustees can manage entities" on public."entities";
create policy "Trustees can manage entities" on public."entities" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "export_log: authenticated can insert" on public."export_log";
create policy "export_log: authenticated can insert" on public."export_log" as permissive for insert to authenticated with check (true);
drop policy if exists "feedback: anyone can submit" on public."feedback";
create policy "feedback: anyone can submit" on public."feedback" as permissive for insert to authenticated with check (true);
drop policy if exists "feedback: founder can delete" on public."feedback";
create policy "feedback: founder can delete" on public."feedback" as permissive for delete to authenticated using (is_founder());
drop policy if exists "feedback: founder can read" on public."feedback";
create policy "feedback: founder can read" on public."feedback" as permissive for select to authenticated using (is_founder());
drop policy if exists "feedback: founder can resolve" on public."feedback";
create policy "feedback: founder can resolve" on public."feedback" as permissive for update to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "Admin trustees can manage finance_balance_sheet" on public."finance_balance_sheet";
create policy "Admin trustees can manage finance_balance_sheet" on public."finance_balance_sheet" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "Admin trustees can manage finance_budgets" on public."finance_budgets";
create policy "Admin trustees can manage finance_budgets" on public."finance_budgets" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "Admin trustees can manage finance_expenses within their entitie" on public."finance_expenses";
create policy "Admin trustees can manage finance_expenses within their entitie" on public."finance_expenses" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Admin trustees can manage finance_income within their entities" on public."finance_income";
create policy "Admin trustees can manage finance_income within their entities" on public."finance_income" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "Admin trustees can manage finance_opening_balances" on public."finance_opening_balances";
create policy "Admin trustees can manage finance_opening_balances" on public."finance_opening_balances" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "founder_metrics: founder only" on public."founder_metrics";
create policy "founder_metrics: founder only" on public."founder_metrics" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "founder_notes: founder only" on public."founder_notes";
create policy "founder_notes: founder only" on public."founder_notes" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "Admin trustees can manage gl_accounts" on public."gl_accounts";
create policy "Admin trustees can manage gl_accounts" on public."gl_accounts" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "Admin trustees can manage gl_category_account_map" on public."gl_category_account_map";
create policy "Admin trustees can manage gl_category_account_map" on public."gl_category_account_map" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "Admin trustees can manage gl_journal_entries" on public."gl_journal_entries";
create policy "Admin trustees can manage gl_journal_entries" on public."gl_journal_entries" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "Admin trustees can manage gl_journal_lines" on public."gl_journal_lines";
create policy "Admin trustees can manage gl_journal_lines" on public."gl_journal_lines" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "goal_links: trustees only" on public."goal_links";
create policy "goal_links: trustees only" on public."goal_links" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "goals: trustees only" on public."goals";
create policy "goals: trustees only" on public."goals" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "google_calendar_connections: own row only" on public."google_calendar_connections";
create policy "google_calendar_connections: own row only" on public."google_calendar_connections" as permissive for all to authenticated using ((trustee_id = auth.uid())) with check ((trustee_id = auth.uid()));
drop policy if exists "owner deletes own calendar connection" on public."google_calendar_connections";
create policy "owner deletes own calendar connection" on public."google_calendar_connections" as permissive for delete to authenticated using ((trustee_id = auth.uid()));
drop policy if exists "owner reads own calendar connection" on public."google_calendar_connections";
create policy "owner reads own calendar connection" on public."google_calendar_connections" as permissive for select to authenticated using ((trustee_id = auth.uid()));
drop policy if exists "owner updates own calendar connection" on public."google_calendar_connections";
create policy "owner updates own calendar connection" on public."google_calendar_connections" as permissive for update to authenticated using ((trustee_id = auth.uid()));
drop policy if exists "grants: trustees only" on public."grants";
create policy "grants: trustees only" on public."grants" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "admin deletes incidents" on public."incidents";
create policy "admin deletes incidents" on public."incidents" as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "incidents: trustees only" on public."incidents";
create policy "incidents: trustees only" on public."incidents" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "trustees insert incidents" on public."incidents";
create policy "trustees insert incidents" on public."incidents" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "trustees read incidents" on public."incidents";
create policy "trustees read incidents" on public."incidents" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "trustees update incidents" on public."incidents";
create policy "trustees update incidents" on public."incidents" as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "interest_register_delete" on public."interest_register";
create policy "interest_register_delete" on public."interest_register" as permissive for delete to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "interest_register_insert" on public."interest_register";
create policy "interest_register_insert" on public."interest_register" as permissive for insert to authenticated with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "interest_register_select" on public."interest_register";
create policy "interest_register_select" on public."interest_register" as permissive for select to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "interest_register_update" on public."interest_register";
create policy "interest_register_update" on public."interest_register" as permissive for update to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "login_attempts: anon and authenticated can insert" on public."login_attempts";
create policy "login_attempts: anon and authenticated can insert" on public."login_attempts" as permissive for insert to anon, authenticated with check (true);
drop policy if exists "marae_settings: admin trustees write" on public."marae_settings";
create policy "marae_settings: admin trustees write" on public."marae_settings" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "marae_settings: trustees read, admin write" on public."marae_settings";
create policy "marae_settings: trustees read, admin write" on public."marae_settings" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "meeting_actions_delete" on public."meeting_actions";
create policy "meeting_actions_delete" on public."meeting_actions" as permissive for delete to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "meeting_actions_insert" on public."meeting_actions";
create policy "meeting_actions_insert" on public."meeting_actions" as permissive for insert to authenticated with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "meeting_actions_select" on public."meeting_actions";
create policy "meeting_actions_select" on public."meeting_actions" as permissive for select to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "meeting_actions_update" on public."meeting_actions";
create policy "meeting_actions_update" on public."meeting_actions" as permissive for update to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id)))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "meeting_calendar_syncs: own row only" on public."meeting_calendar_syncs";
create policy "meeting_calendar_syncs: own row only" on public."meeting_calendar_syncs" as permissive for all to authenticated using ((trustee_id = auth.uid())) with check ((trustee_id = auth.uid()));
drop policy if exists "trustees delete own calendar syncs" on public."meeting_calendar_syncs";
create policy "trustees delete own calendar syncs" on public."meeting_calendar_syncs" as permissive for delete to authenticated using ((trustee_id = auth.uid()));
drop policy if exists "trustees insert own calendar syncs" on public."meeting_calendar_syncs";
create policy "trustees insert own calendar syncs" on public."meeting_calendar_syncs" as permissive for insert to authenticated with check ((trustee_id = auth.uid()));
drop policy if exists "trustees read own calendar syncs" on public."meeting_calendar_syncs";
create policy "trustees read own calendar syncs" on public."meeting_calendar_syncs" as permissive for select to authenticated using ((trustee_id = auth.uid()));
drop policy if exists "meetings_delete" on public."meetings";
create policy "meetings_delete" on public."meetings" as permissive for delete to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "meetings_insert" on public."meetings";
create policy "meetings_insert" on public."meetings" as permissive for insert to authenticated with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "meetings_select" on public."meetings";
create policy "meetings_select" on public."meetings" as permissive for select to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "meetings_update" on public."meetings";
create policy "meetings_update" on public."meetings" as permissive for update to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "module_kpi_snapshots: trustees read" on public."module_kpi_snapshots";
create policy "module_kpi_snapshots: trustees read" on public."module_kpi_snapshots" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "notices: trustees only" on public."notices";
create policy "notices: trustees only" on public."notices" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "notification_log: founder read" on public."notification_log";
create policy "notification_log: founder read" on public."notification_log" as permissive for select to authenticated using (is_founder());
drop policy if exists "trustees read own notification log" on public."notification_log";
create policy "trustees read own notification log" on public."notification_log" as permissive for select to authenticated using ((trustee_id = auth.uid()));
drop policy if exists "profiles: own row or trustee can update" on public."profiles";
create policy "profiles: own row or trustee can update" on public."profiles" as permissive for update to authenticated using (((id = auth.uid()) OR is_trustee())) with check (((id = auth.uid()) OR is_trustee()));
drop policy if exists "profiles: read own row" on public."profiles";
create policy "profiles: read own row" on public."profiles" as permissive for select to authenticated using ((id = auth.uid()));
drop policy if exists "profiles: trustees can insert profiles" on public."profiles";
create policy "profiles: trustees can insert profiles" on public."profiles" as permissive for insert to authenticated with check (is_trustee());
drop policy if exists "profiles: trustees read every profile in their marae" on public."profiles";
create policy "profiles: trustees read every profile in their marae" on public."profiles" as permissive for select to authenticated using (is_trustee());
drop policy if exists "projects: trustees only" on public."projects";
create policy "projects: trustees only" on public."projects" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "resolutions_delete" on public."resolutions";
create policy "resolutions_delete" on public."resolutions" as permissive for delete to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "resolutions_insert" on public."resolutions";
create policy "resolutions_insert" on public."resolutions" as permissive for insert to authenticated with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "resolutions_select" on public."resolutions";
create policy "resolutions_select" on public."resolutions" as permissive for select to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "resolutions_update" on public."resolutions";
create policy "resolutions_update" on public."resolutions" as permissive for update to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id)))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(get_meeting_entity_id(meeting_id))));
drop policy if exists "Trustees can manage risk_register within their entities" on public."risk_register";
create policy "Trustees can manage risk_register within their entities" on public."risk_register" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "role_configs: founder manages" on public."role_configs";
create policy "role_configs: founder manages" on public."role_configs" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "role_configs: trustees read" on public."role_configs";
create policy "role_configs: trustees read" on public."role_configs" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "service_reminders: trustees only" on public."service_reminders";
create policy "service_reminders: trustees only" on public."service_reminders" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "admin reads stripe events" on public."stripe_webhook_events";
create policy "admin reads stripe events" on public."stripe_webhook_events" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "stripe_webhook_events: founder read" on public."stripe_webhook_events";
create policy "stripe_webhook_events: founder read" on public."stripe_webhook_events" as permissive for select to authenticated using (is_founder());
drop policy if exists "system_check_log: founder only" on public."system_check_log";
create policy "system_check_log: founder only" on public."system_check_log" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "task_comments: trustees within entity via task" on public."task_comments";
create policy "task_comments: trustees within entity via task" on public."task_comments" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND (EXISTS ( SELECT 1
   FROM (tasks t
     LEFT JOIN workflow_instances wi ON ((wi.id = t.workflow_instance_id)))
  WHERE ((t.id = task_comments.task_id) AND ((t.workflow_instance_id IS NULL) OR is_entity_member(wi.entity_id))))))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND (EXISTS ( SELECT 1
   FROM (tasks t
     LEFT JOIN workflow_instances wi ON ((wi.id = t.workflow_instance_id)))
  WHERE ((t.id = task_comments.task_id) AND ((t.workflow_instance_id IS NULL) OR is_entity_member(wi.entity_id)))))));
drop policy if exists "tasks: trustees within entity via workflow" on public."tasks";
create policy "tasks: trustees within entity via workflow" on public."tasks" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND ((workflow_instance_id IS NULL) OR (EXISTS ( SELECT 1
   FROM workflow_instances wi
  WHERE ((wi.id = tasks.workflow_instance_id) AND is_entity_member(wi.entity_id))))))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND ((workflow_instance_id IS NULL) OR (EXISTS ( SELECT 1
   FROM workflow_instances wi
  WHERE ((wi.id = tasks.workflow_instance_id) AND is_entity_member(wi.entity_id)))))));
drop policy if exists "Admin trustees manage assignments" on public."trustee_entities";
create policy "Admin trustees manage assignments" on public."trustee_entities" as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))));
drop policy if exists "Trustees view own assignments, admins view all" on public."trustee_entities";
create policy "Trustees view own assignments, admins view all" on public."trustee_entities" as permissive for select to authenticated using (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))));
drop policy if exists "workflow_instances: trustees manage within entity" on public."workflow_instances";
create policy "workflow_instances: trustees manage within entity" on public."workflow_instances" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "workflow_steps: founder manages" on public."workflow_steps";
create policy "workflow_steps: founder manages" on public."workflow_steps" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "workflow_steps: trustees read" on public."workflow_steps";
create policy "workflow_steps: trustees read" on public."workflow_steps" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "workflow_templates: founder manages" on public."workflow_templates";
create policy "workflow_templates: founder manages" on public."workflow_templates" as permissive for all to authenticated using (is_founder()) with check (is_founder());
drop policy if exists "workflow_templates: trustees read" on public."workflow_templates";
create policy "workflow_templates: trustees read" on public."workflow_templates" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))));
drop policy if exists "entity admins delete xero connection" on public."xero_connections";
create policy "entity admins delete xero connection" on public."xero_connections" as permissive for delete to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND (connected_by = auth.uid())));
drop policy if exists "entity admins read xero connection" on public."xero_connections";
create policy "entity admins read xero connection" on public."xero_connections" as permissive for select to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND ((EXISTS ( SELECT 1
   FROM trustee_entities te
  WHERE ((te.profile_id = auth.uid()) AND (te.entity_id = xero_connections.entity_id)))) OR (connected_by = auth.uid()))));
drop policy if exists "xero_connections: admin trustees within entity" on public."xero_connections";
create policy "xero_connections: admin trustees within entity" on public."xero_connections" as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND is_entity_member(entity_id))) with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))) AND is_entity_member(entity_id)));
drop policy if exists "compliance-docs: allow all uploads" on storage."objects";
create policy "compliance-docs: allow all uploads" on storage."objects" as permissive for all to authenticated using ((bucket_id = 'compliance-docs'::text)) with check ((bucket_id = 'compliance-docs'::text));
drop policy if exists "contractor-docs: allow all uploads" on storage."objects";
create policy "contractor-docs: allow all uploads" on storage."objects" as permissive for all to authenticated using ((bucket_id = 'contractor-docs'::text)) with check ((bucket_id = 'contractor-docs'::text));
drop policy if exists "documents: authenticated delete" on storage."objects";
create policy "documents: authenticated delete" on storage."objects" as permissive for delete to authenticated using ((bucket_id = 'documents'::text));
drop policy if exists "documents: authenticated insert" on storage."objects";
create policy "documents: authenticated insert" on storage."objects" as permissive for insert to authenticated with check ((bucket_id = 'documents'::text));
drop policy if exists "documents: authenticated read" on storage."objects";
create policy "documents: authenticated read" on storage."objects" as permissive for select to authenticated using ((bucket_id = 'documents'::text));
drop policy if exists "documents: authenticated update" on storage."objects";
create policy "documents: authenticated update" on storage."objects" as permissive for update to authenticated using ((bucket_id = 'documents'::text)) with check ((bucket_id = 'documents'::text));
drop policy if exists "emergency-response-evidence: allow all uploads" on storage."objects";
create policy "emergency-response-evidence: allow all uploads" on storage."objects" as permissive for all to authenticated using ((bucket_id = 'emergency-response-evidence'::text)) with check ((bucket_id = 'emergency-response-evidence'::text));
drop policy if exists "finance-receipts: allow all uploads" on storage."objects";
create policy "finance-receipts: allow all uploads" on storage."objects" as permissive for all to authenticated using ((bucket_id = 'finance-receipts'::text)) with check ((bucket_id = 'finance-receipts'::text));
drop policy if exists "meeting-attachments: allow all uploads" on storage."objects";
create policy "meeting-attachments: allow all uploads" on storage."objects" as permissive for all to authenticated using ((bucket_id = 'meeting-attachments'::text)) with check ((bucket_id = 'meeting-attachments'::text));
drop policy if exists "meeting-attachments: allow deletes" on storage."objects";
create policy "meeting-attachments: allow deletes" on storage."objects" as permissive for delete to authenticated using ((bucket_id = 'meeting-attachments'::text));
drop policy if exists "meeting-attachments: allow reads" on storage."objects";
create policy "meeting-attachments: allow reads" on storage."objects" as permissive for select to authenticated using ((bucket_id = 'meeting-attachments'::text));
drop policy if exists "meeting-attachments: allow uploads" on storage."objects";
create policy "meeting-attachments: allow uploads" on storage."objects" as permissive for insert to authenticated with check ((bucket_id = 'meeting-attachments'::text));
drop policy if exists "storage: admin trustees access finance-receipts" on storage."objects";
create policy "storage: admin trustees access finance-receipts" on storage."objects" as permissive for all to authenticated using (((bucket_id = 'finance-receipts'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text)))))) with check (((bucket_id = 'finance-receipts'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text) AND (profiles.trustee_role = 'admin'::text))))));
drop policy if exists "storage: founder access legacy Storage bucket" on storage."objects";
create policy "storage: founder access legacy Storage bucket" on storage."objects" as permissive for all to authenticated using (((bucket_id = 'Storage'::text) AND is_founder())) with check (((bucket_id = 'Storage'::text) AND is_founder()));
drop policy if exists "storage: trustees access sensitive buckets" on storage."objects";
create policy "storage: trustees access sensitive buckets" on storage."objects" as permissive for all to authenticated using (((bucket_id = ANY (ARRAY['documents'::text, 'compliance-docs'::text, 'emergency-response-evidence'::text])) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text)))))) with check (((bucket_id = ANY (ARRAY['documents'::text, 'compliance-docs'::text, 'emergency-response-evidence'::text])) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trustee'::text))))));

-- STORAGE BUCKETS (configuration only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('compliance-docs', 'compliance-docs', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('contractor-docs', 'contractor-docs', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documents', 'documents', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('emergency-response-evidence', 'emergency-response-evidence', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('finance-receipts', 'finance-receipts', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('meeting-attachments', 'meeting-attachments', false, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('Storage', 'Storage', false, null, null) on conflict (id) do nothing;

-- TABLE GRANTS
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."action_reminder_tokens" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."action_reminder_tokens" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."action_reminder_tokens" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."assets" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."assets" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."assets" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."audit_log" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."audit_log" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."audit_log" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."backup_file_log" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."backup_file_log" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."backup_file_log" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."backup_runs" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."backup_runs" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."backup_runs" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bank_reconciliations" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bank_reconciliations" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bank_reconciliations" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."blocked_dates" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."blocked_dates" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."blocked_dates" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."booking_checklists" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."booking_checklists" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."booking_checklists" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."booking_feedback" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."booking_feedback" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."booking_feedback" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bookings" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bookings" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bookings" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."check_alert_state" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."check_alert_state" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."check_alert_state" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."checklist_templates" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."checklist_templates" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."checklist_templates" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."compliance_items" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."compliance_items" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."compliance_items" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."contacts" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."contacts" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."contacts" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."contractors" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."contractors" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."contractors" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."documents" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."documents" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."documents" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_building_plans" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_building_plans" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_building_plans" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_map_points" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_map_points" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_map_points" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_hazards" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_hazards" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_hazards" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_people" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_people" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_people" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_pins" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_pins" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_plan_pins" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_response_events" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_response_events" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_response_events" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_welfare_checks" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_welfare_checks" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."emergency_welfare_checks" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."entities" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."entities" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."entities" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."export_log" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."export_log" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."export_log" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."feedback" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."feedback" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."feedback" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_balance_sheet" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_balance_sheet" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_balance_sheet" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_budgets" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_budgets" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_budgets" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_expenses" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_expenses" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_expenses" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_income" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_income" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_income" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_opening_balances" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_opening_balances" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."finance_opening_balances" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."founder_metrics" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."founder_metrics" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."founder_metrics" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."founder_notes" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."founder_notes" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."founder_notes" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_accounts" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_accounts" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_accounts" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_category_account_map" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_category_account_map" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_category_account_map" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_journal_entries" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_journal_entries" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_journal_entries" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_journal_lines" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_journal_lines" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."gl_journal_lines" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."goal_links" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."goal_links" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."goal_links" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."goals" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."goals" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."goals" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."google_calendar_connections" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."google_calendar_connections" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."google_calendar_connections" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."grants" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."grants" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."grants" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."incidents" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."incidents" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."incidents" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."interest_register" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."interest_register" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."interest_register" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."login_attempts" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."login_attempts" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."login_attempts" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."marae_settings" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."marae_settings" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."marae_settings" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meeting_actions" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meeting_actions" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meeting_actions" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meeting_calendar_syncs" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meeting_calendar_syncs" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meeting_calendar_syncs" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meetings" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meetings" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."meetings" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."module_kpi_snapshots" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."module_kpi_snapshots" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."module_kpi_snapshots" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notices" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notices" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notices" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notification_log" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notification_log" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notification_log" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."profiles" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."profiles" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."profiles" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."projects" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."projects" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."projects" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."resolutions" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."resolutions" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."resolutions" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."risk_register" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."risk_register" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."risk_register" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."role_configs" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."role_configs" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."role_configs" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."service_reminders" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."service_reminders" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."service_reminders" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."stripe_webhook_events" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."stripe_webhook_events" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."stripe_webhook_events" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."system_check_log" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."system_check_log" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."system_check_log" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."task_comments" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."task_comments" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."task_comments" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."tasks" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."tasks" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."tasks" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."trustee_entities" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."trustee_entities" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."trustee_entities" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_instances" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_instances" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_instances" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_steps" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_steps" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_steps" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_templates" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_templates" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."workflow_templates" to service_role;
grant SELECT on public."xero_connection_status" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."xero_connection_status" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."xero_connections" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."xero_connections" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."xero_connections" to service_role;
