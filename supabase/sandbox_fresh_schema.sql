-- ═════════════════════════════════════════════════════════════════════════════
-- MaraeHub — Complete Fresh Database Schema
-- ═════════════════════════════════════════════════════════════════════════════
-- Run this entire file in the Supabase SQL editor on a brand-new empty project.
-- Tables are ordered by dependency (referenced tables first).
-- This reflects the full final state including all migrations up to 2026-06-22.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
-- uuid_generate_v4() is used by some helpers; gen_random_uuid() is built-in
-- in Postgres 13+ (which Supabase uses), but enable it just in case.
create extension if not exists "uuid-ossp";


-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
-- Auth-backed users. id must match auth.users (created by signUp).
-- notification_prefs controls which email notifications each trustee receives.
-- trustee_role: 'admin' can approve bookings, access Finance, manage users.

create table if not exists profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  full_name           text,
  email               text,
  role                text        not null default 'community'
                                  check (role in ('trustee', 'community')),
  phone               text,
  notes               text,
  notification_prefs  jsonb       not null default
                                  '{"bookings":true,"compliance":true,"grants":true,"actions":true,"goals":true}'::jsonb,
  trustee_role        text        default 'standard'
                                  check (trustee_role in ('standard', 'admin')),
  created_at          timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: authenticated full access"
  on profiles for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- CONTACTS
-- ─────────────────────────────────────────────────────────────────────────────
-- Community members without a Supabase auth account.
-- profiles.id is a FK to auth.users so no-email entries live here instead.

create table if not exists contacts (
  id         uuid        primary key default gen_random_uuid(),
  full_name  text        not null,
  role       text        not null default 'community'
                         check (role in ('trustee', 'community')),
  email      text,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table contacts enable row level security;

create policy "contacts: authenticated full access"
  on contacts for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRACTORS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists contractors (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  trade      text        not null default 'Other'
                         check (trade in (
                           'Plumber','Electrician','Builder','Roofer','Painter',
                           'Landscaper','Cleaning','IT','Legal','Accounting','Other'
                         )),
  company    text,
  phone      text,
  email      text,
  address    text,
  notes      text,
  preferred  boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table contractors enable row level security;

create policy "contractors: authenticated full access"
  on contractors for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- MARAE_SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
-- Single-row table. The app upserts on the one row using .limit(1).single().

create table if not exists marae_settings (
  id         uuid        primary key default gen_random_uuid(),
  marae_name text        not null default '',
  location   text,
  iwi        text,
  hapu       text,
  phone      text,
  email      text,
  website    text,
  use_xero   boolean     not null default false,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table marae_settings enable row level security;

create policy "marae_settings: authenticated full access"
  on marae_settings for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECKLIST_TEMPLATES
-- ─────────────────────────────────────────────────────────────────────────────
-- Reusable exit-checklist items managed in Settings.
-- Copied into booking_checklists when a checklist is started for a booking.

create table if not exists checklist_templates (
  id         uuid        primary key default gen_random_uuid(),
  label      text        not null,
  sort_order integer     not null default 0,
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

alter table checklist_templates enable row level security;

create policy "checklist_templates: authenticated full access"
  on checklist_templates for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCKED_DATES
-- ─────────────────────────────────────────────────────────────────────────────
-- Date ranges trustees mark as unavailable on the booking calendar.

create table if not exists blocked_dates (
  id         uuid        primary key default gen_random_uuid(),
  from_date  date        not null,
  to_date    date        not null,
  reason     text        not null default '',
  created_at timestamptz not null default now()
);

alter table blocked_dates enable row level security;

create policy "blocked_dates: authenticated full access"
  on blocked_dates for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────
-- Venue booking requests. reference format: 'MH-YYYY-XXXX' (app-generated).
-- facilities: jsonb array of strings, e.g. ["Kitchen","Hall","Carpark"].

create table if not exists bookings (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete set null,
  occasion   text        not null
                         check (occasion in (
                           'Tangi','Wedding/Hakari','Birthday','Hui',
                           'Fundraiser','Whanau Reunion','Other'
                         )),
  start_date date        not null,
  end_date   date        not null,
  guests     integer     not null default 0 check (guests >= 0),
  overnight  boolean     not null default false,
  facilities jsonb       not null default '[]'::jsonb,
  notes      text,
  status     text        not null default 'pending'
                         check (status in ('pending','approved','declined')),
  reference  text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_user_id    on bookings(user_id);
create index if not exists idx_bookings_status     on bookings(status);
create index if not exists idx_bookings_start_date on bookings(start_date);

alter table bookings enable row level security;

create policy "bookings: authenticated full access"
  on bookings for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKING_CHECKLISTS
-- ─────────────────────────────────────────────────────────────────────────────
-- One per booking. items: [{ "id": uuid, "label": text, "checked": bool, "notes": text }, ...]
-- Seeded from checklist_templates when first opened.

create table if not exists booking_checklists (
  id           uuid        primary key default gen_random_uuid(),
  booking_id   uuid        not null references bookings(id) on delete cascade,
  items        jsonb       not null default '[]'::jsonb,
  notes        text,
  completed    boolean     not null default false,
  completed_at timestamptz,
  completed_by text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_booking_checklists_booking_id on booking_checklists(booking_id);

alter table booking_checklists enable row level security;

create policy "booking_checklists: authenticated full access"
  on booking_checklists for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKING_FEEDBACK
-- ─────────────────────────────────────────────────────────────────────────────
-- Post-stay ratings submitted by the booking's user. One row per booking.

create table if not exists booking_feedback (
  id                 uuid        primary key default gen_random_uuid(),
  booking_id         uuid        not null references bookings(id) on delete cascade,
  user_id            uuid        references auth.users(id) on delete set null,
  rating_overall     integer     check (rating_overall     between 0 and 5),
  rating_cleanliness integer     check (rating_cleanliness between 0 and 5),
  rating_facilities  integer     check (rating_facilities  between 0 and 5),
  experience         text,
  would_return       boolean,
  suggestions        text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_booking_feedback_booking_id on booking_feedback(booking_id);

alter table booking_feedback enable row level security;

create policy "booking_feedback: authenticated full access"
  on booking_feedback for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- NOTICES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists notices (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  body       text        not null default '',
  category   text        not null default 'General'
                         check (category in ('General','Urgent','Event','Maintenance')),
  author     text,
  created_at timestamptz not null default now()
);

alter table notices enable row level security;

create policy "notices: authenticated full access"
  on notices for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────────────────────────────────────
-- Metadata for files uploaded to the 'documents' storage bucket.
-- file_url is the public URL returned by storage.getPublicUrl().

create table if not exists documents (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  category   text        not null default 'Other'
                         check (category in (
                           'Governance','Finance','Legal',
                           'Health & Safety','Policies','Other'
                         )),
  notes      text,
  file_name  text,
  file_size  integer,
  file_type  text,
  file_url   text,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;

create policy "documents: authenticated full access"
  on documents for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────────────────────
-- subtasks: [{ "id": uuid, "title": text, "assigned_to": text, "due_date": date,
--              "priority": "High"|"Medium"|"Low", "status": text, "created_at": timestamptz }]

create table if not exists projects (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  status     text        not null default 'planning'
                         check (status in ('planning','active','review','completed')),
  progress   integer     not null default 0 check (progress between 0 and 100),
  lead       text,
  due_date   date,
  notes      text,
  subtasks   jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_status   on projects(status);
create index if not exists idx_projects_due_date on projects(due_date);

alter table projects enable row level security;

create policy "projects: authenticated full access"
  on projects for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- ASSETS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists assets (
  id         uuid         primary key default gen_random_uuid(),
  name       text         not null,
  category   text         not null default 'Other'
                          check (category in (
                            'Building','Equipment','Vehicle',
                            'Technology','Grounds','Other'
                          )),
  location   text,
  condition  text         default 'good'
                          check (condition in ('good','fair','poor')),
  value      numeric(12,2),
  notes      text,
  created_at timestamptz  not null default now()
);

alter table assets enable row level security;

create policy "assets: authenticated full access"
  on assets for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- SERVICE_REMINDERS
-- ─────────────────────────────────────────────────────────────────────────────
-- Scheduled maintenance reminders linked to an asset.

create table if not exists service_reminders (
  id         uuid        primary key default gen_random_uuid(),
  asset_id   uuid        not null references assets(id) on delete cascade,
  type       text        not null,
  due_date   date,
  recurring  text        not null default 'none'
                         check (recurring in (
                           'none','monthly','quarterly','biannual','annual','2years'
                         )),
  notes                 text,
  auto_workflow_enabled boolean     not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists idx_service_reminders_asset_id on service_reminders(asset_id);
create index if not exists idx_service_reminders_due_date on service_reminders(due_date);

alter table service_reminders enable row level security;

create policy "service_reminders: authenticated full access"
  on service_reminders for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- GRANTS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists grants (
  id             uuid         primary key default gen_random_uuid(),
  name           text         not null,
  funder         text,
  amount         numeric(12,2),
  category       text         not null default 'Other'
                              check (category in (
                                'Community','Cultural','Education','Environment',
                                'Health','Infrastructure','Sport & Recreation','Other'
                              )),
  status         text         not null default 'researching'
                              check (status in (
                                'researching','in-progress','submitted',
                                'approved','declined','reporting'
                              )),
  deadline       date,
  submitted_date date,
  decision_date  date,
  reporting_date date,
  contact_name   text,
  contact_email  text,
  notes          text,
  created_at     timestamptz  not null default now()
);

create index if not exists idx_grants_status   on grants(status);
create index if not exists idx_grants_deadline on grants(deadline);

alter table grants enable row level security;

create policy "grants: authenticated full access"
  on grants for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- MEETINGS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists meetings (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  meeting_type text        not null default 'Trustee Meeting'
                           check (meeting_type in (
                             'Trustee Meeting','AGM','Special Meeting',
                             'Committee Meeting','Working Group Meeting'
                           )),
  meeting_date date        not null,
  chairperson  text,
  secretary    text,
  attendees    text,
  apologies    text,
  minutes      text,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_meetings_meeting_date on meetings(meeting_date);

alter table meetings enable row level security;

create policy "meetings: authenticated full access"
  on meetings for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- RESOLUTIONS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists resolutions (
  id                uuid        primary key default gen_random_uuid(),
  meeting_id        uuid        not null references meetings(id) on delete cascade,
  resolution_number text,
  description       text        not null,
  date_passed       date,
  status            text        not null default 'Open'
                                check (status in ('Open','In Progress','Completed','Cancelled')),
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_resolutions_meeting_id on resolutions(meeting_id);
create index if not exists idx_resolutions_status     on resolutions(status);

alter table resolutions enable row level security;

create policy "resolutions: authenticated full access"
  on resolutions for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- MEETING_ACTIONS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists meeting_actions (
  id          uuid        primary key default gen_random_uuid(),
  meeting_id  uuid        not null references meetings(id) on delete cascade,
  description text        not null,
  assigned_to text,
  due_date    date,
  status      text        not null default 'Open'
                          check (status in ('Open','In Progress','Completed')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_meeting_actions_meeting_id on meeting_actions(meeting_id);

alter table meeting_actions enable row level security;

create policy "meeting_actions: authenticated full access"
  on meeting_actions for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- FEEDBACK
-- ─────────────────────────────────────────────────────────────────────────────
-- In-app feedback submitted via the floating feedback button.

create table if not exists feedback (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete set null,
  user_name  text,
  user_email text,
  type       text        not null default 'suggestion'
                         check (type in ('bug','suggestion','question','compliment')),
  message    text        not null,
  page       text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "feedback: authenticated users can insert"
  on feedback for insert
  to authenticated
  with check (true);

create policy "feedback: authenticated users can read"
  on feedback for select
  to authenticated
  using (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- COMPLIANCE_ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
-- Recurring compliance obligations (Building WOFs, insurance, H&S, etc.).
-- Uses responsible_name (text) — not a FK — so any name can be recorded.
-- last_checked_date: date the item was physically verified.

create table if not exists compliance_items (
  id                uuid        primary key default gen_random_uuid(),
  category          text        not null
                                check (category in (
                                  'building','insurance','trustee',
                                  'health_safety','civil_defence',
                                  'emergency_preparedness','other'
                                )),
  name              text        not null,
  due_date          date,
  renewal_months    integer,
  responsible_name  text,
  notes             text,
  document_url      text,
  document_name     text,
  last_checked_date date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table compliance_items enable row level security;

create policy "compliance_items: authenticated full access"
  on compliance_items for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- INCIDENTS
-- ─────────────────────────────────────────────────────────────────────────────
-- Incident register: H&S incidents, near-misses, property incidents.

create table if not exists incidents (
  id               uuid        primary key default gen_random_uuid(),
  incident_date    date        not null default current_date,
  title            text        not null,
  description      text,
  location         text,
  severity         text        not null default 'minor'
                               check (severity in ('minor','moderate','serious','critical')),
  people_involved  text,
  responsible_name text,
  action_taken     text,
  follow_up_date   date,
  resolved         boolean     not null default false,
  document_url     text,
  document_name    text,
  created_at       timestamptz not null default now()
);

alter table incidents enable row level security;

create policy "incidents: authenticated full access"
  on incidents for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATION_LOG
-- ─────────────────────────────────────────────────────────────────────────────
-- Prevents duplicate notification sends. entity_id is text (not FK) because
-- it references rows across different tables.

create table if not exists notification_log (
  id                uuid        primary key default gen_random_uuid(),
  notification_type text        not null,
  entity_id         text        not null,
  entity_key        text,
  trustee_id        uuid        references profiles(id) on delete cascade,
  sent_at           timestamptz not null default now()
);

create index if not exists idx_notification_log_lookup
  on notification_log (notification_type, entity_id, trustee_id, sent_at desc);

alter table notification_log enable row level security;

create policy "notification_log: service role full access"
  on notification_log for all
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- GOALS
-- ─────────────────────────────────────────────────────────────────────────────
-- Strategic goals that can be linked to projects, compliance items, or grants.

create table if not exists goals (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  description      text,
  category         text        not null default 'governance',
  responsible_name text,
  start_date       date,
  target_date      date,
  status           text        not null default 'not_started'
                               check (status in (
                                 'not_started','in_progress','at_risk','completed'
                               )),
  progress         integer     not null default 0
                               check (progress >= 0 and progress <= 100),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table goals enable row level security;

create policy "goals: authenticated full access"
  on goals for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- GOAL_LINKS
-- ─────────────────────────────────────────────────────────────────────────────
-- Joins goals to projects, compliance_items, or grants for auto-progress tracking.

create table if not exists goal_links (
  id         uuid        primary key default gen_random_uuid(),
  goal_id    uuid        not null references goals(id) on delete cascade,
  link_type  text        not null
                         check (link_type in ('project','compliance_item','grant')),
  link_id    uuid        not null,
  created_at timestamptz not null default now(),
  unique (goal_id, link_type, link_id)
);

alter table goal_links enable row level security;

create policy "goal_links: authenticated full access"
  on goal_links for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW_TEMPLATES
-- ─────────────────────────────────────────────────────────────────────────────
-- Reusable task checklists. workflow_steps defines the ordered steps.

create table if not exists workflow_templates (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  category    text,
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table workflow_templates enable row level security;

create policy "workflow_templates: authenticated full access"
  on workflow_templates for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW_STEPS
-- ─────────────────────────────────────────────────────────────────────────────
-- Ordered steps belonging to a workflow template.

create table if not exists workflow_steps (
  id          uuid        primary key default gen_random_uuid(),
  template_id uuid        not null references workflow_templates(id) on delete cascade,
  title       text        not null,
  description text,
  step_order  integer     not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists idx_workflow_steps_template_id on workflow_steps(template_id);
create index if not exists idx_workflow_steps_order       on workflow_steps(template_id, step_order);

alter table workflow_steps enable row level security;

create policy "workflow_steps: authenticated full access"
  on workflow_steps for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- WORKFLOW_INSTANCES
-- ─────────────────────────────────────────────────────────────────────────────
-- A running instance of a workflow template. Linked tasks track progress.

create table if not exists workflow_instances (
  id           uuid        primary key default gen_random_uuid(),
  template_id  uuid        references workflow_templates(id) on delete set null,
  name         text        not null,
  status       text        not null default 'active'
                           check (status in ('active','complete','cancelled')),
  progress_pct integer     not null default 0
                           check (progress_pct >= 0 and progress_pct <= 100),
  due_date     date,
  created_by   text,
  entity_type  text,
  entity_id    uuid,
  entity_name  text,
  trigger_type text,
  trigger_date date,
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_workflow_instances_status     on workflow_instances(status);
create index if not exists idx_workflow_instances_started_at on workflow_instances(started_at desc);

alter table workflow_instances enable row level security;

create policy "workflow_instances: authenticated full access"
  on workflow_instances for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────────────────────────────────────────
-- Standalone tasks and workflow-generated tasks.
-- parent_task_id: set on subtasks; null on standalone tasks and workflow parent tasks.
-- workflow_instance_id: links a task to its workflow instance.
-- workflow_step_order: preserves step ordering within a workflow.

create table if not exists tasks (
  id                   uuid        primary key default gen_random_uuid(),
  title                text        not null,
  description          text,
  assigned_to          text,
  due_date             date,
  priority             text        not null default 'Medium'
                                   check (priority in ('High','Medium','Low')),
  status               text        not null default 'open'
                                   check (status in ('open','in-progress','completed','cancelled')),
  completed_at         timestamptz,
  parent_task_id       uuid        references tasks(id) on delete cascade,
  workflow_instance_id uuid        references workflow_instances(id) on delete cascade,
  workflow_step_order  integer,
  created_at           timestamptz not null default now()
);

create index if not exists idx_tasks_status               on tasks(status);
create index if not exists idx_tasks_due_date             on tasks(due_date);
create index if not exists idx_tasks_parent_task_id       on tasks(parent_task_id);
create index if not exists idx_tasks_workflow_instance_id on tasks(workflow_instance_id);

alter table tasks enable row level security;

create policy "tasks: authenticated full access"
  on tasks for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCE_INCOME
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists finance_income (
  id          uuid          primary key default gen_random_uuid(),
  date        date          not null,
  description text          not null,
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  category    text          not null default 'Other'
                            check (category in (
                              'Booking Income','Grant Income','Koha',
                              'Hire Equipment','Fundraiser','Other'
                            )),
  reference   text,
  notes       text,
  status      text          not null default 'Confirmed'
                            check (status in ('Confirmed','Pending')),
  source_type text,
  source_id   uuid,
  created_at  timestamptz   not null default now()
);

create index if not exists idx_finance_income_date     on finance_income(date);
create index if not exists idx_finance_income_category on finance_income(category);
create index if not exists idx_finance_income_source   on finance_income(source_id);

alter table finance_income enable row level security;

create policy "finance_income: authenticated full access"
  on finance_income for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCE_EXPENSES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists finance_expenses (
  id           uuid          primary key default gen_random_uuid(),
  date         date          not null,
  description  text          not null,
  amount       numeric(12,2) not null default 0 check (amount >= 0),
  category     text          not null default 'Other'
                             check (category in (
                               'Maintenance and Repairs','Utilities','Insurance',
                               'Events','Administration','Wages','Equipment','Cleaning','Other'
                             )),
  payee        text,
  reference    text,
  receipt_url  text,
  receipt_name text,
  notes        text,
  status       text          not null default 'Paid'
                             check (status in ('Paid','Pending')),
  created_at   timestamptz   not null default now()
);

create index if not exists idx_finance_expenses_date     on finance_expenses(date);
create index if not exists idx_finance_expenses_category on finance_expenses(category);

alter table finance_expenses enable row level security;

create policy "finance_expenses: authenticated full access"
  on finance_expenses for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCE_BUDGETS
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per (financial_year, category). FY = April 1 – March 31.
-- financial_year stores the April start year (2024 = Apr 2024 – Mar 2025).

create table if not exists finance_budgets (
  id             uuid          primary key default gen_random_uuid(),
  financial_year integer       not null,
  category       text          not null,
  amount         numeric(12,2) not null default 0,
  updated_at     timestamptz,
  created_at     timestamptz   not null default now(),
  unique (financial_year, category)
);

create index if not exists idx_finance_budgets_fy on finance_budgets(financial_year);

alter table finance_budgets enable row level security;

create policy "finance_budgets: authenticated full access"
  on finance_budgets for all
  to authenticated
  using (true)
  with check (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCE_BALANCE_SHEET
-- ─────────────────────────────────────────────────────────────────────────────
-- Single-row table — upserted by the app. Equipment value pulled live from assets.
-- Includes all columns from v1, v2, and investments migrations.

create table if not exists finance_balance_sheet (
  id                          uuid          primary key default gen_random_uuid(),

  -- Core balances
  cash_balance                numeric(12,2) not null default 0,

  -- Other assets
  other_assets                numeric(12,2) not null default 0,
  other_assets_notes          text,

  -- Investments (named columns from v2 migration)
  investments_term_deposits   numeric(12,2) not null default 0,
  investments_shares          numeric(12,2) not null default 0,
  investments_property        numeric(12,2) not null default 0,
  investments_other           numeric(12,2) not null default 0,
  investments_notes           text,

  -- Investments (alternate-named columns from investments migration)
  term_deposits               numeric       not null default 0,
  shares_bonds                numeric       not null default 0,
  property_investments        numeric       not null default 0,
  other_investments           numeric       not null default 0,

  -- Liabilities
  loans                       numeric(12,2) not null default 0,
  loans_notes                 text,
  outstanding_payments        numeric(12,2) not null default 0,
  outstanding_notes           text,
  accounts_payable            numeric(12,2) not null default 0,
  accounts_payable_notes      text,
  other_liabilities           numeric(12,2) not null default 0,
  other_liabilities_notes     text,

  updated_at                  timestamptz,
  created_at                  timestamptz   not null default now()
);

alter table finance_balance_sheet enable row level security;

create policy "finance_balance_sheet: authenticated full access"
  on finance_balance_sheet for all
  to authenticated
  using (true)
  with check (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- AUTH TRIGGER
-- ═════════════════════════════════════════════════════════════════════════════
-- Auto-creates a profiles row for any user who signs up via Supabase Auth,
-- including dashboard invites that bypass UserManager.
-- Derives a display name from the email prefix (e.g. "john.doe" → "John Doe").

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ═════════════════════════════════════════════════════════════════════════════
-- SEED DATA — COMPLIANCE ITEMS
-- ═════════════════════════════════════════════════════════════════════════════
-- Standard NZ marae compliance obligations. Only inserts if table is empty.

insert into compliance_items (category, name, renewal_months)
select * from (values
  ('building',      'Building Warrant of Fitness',          12),
  ('insurance',     'Building & Contents Insurance',        12),
  ('insurance',     'Public Liability Insurance',           12),
  ('trustee',       'Trustee Elections / Term Review',      36),
  ('health_safety', 'Health & Safety Policy Review',        12),
  ('health_safety', 'First Aid Kit Inspection',              6),
  ('health_safety', 'Fire Extinguisher Service',            12),
  ('health_safety', 'Emergency Evacuation Drill',           12),
  ('civil_defence', 'Civil Defence Emergency Plan Review',  24),
  ('civil_defence', 'Emergency Contact List Update',        12)
) as v(category, name, renewal_months)
where not exists (select 1 from compliance_items limit 1);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEED DATA — EMERGENCY PREPAREDNESS COMPLIANCE ITEMS
-- ═════════════════════════════════════════════════════════════════════════════

insert into compliance_items (category, name, renewal_months, notes)
select category, name, renewal_months, notes
from (values
  ('emergency_preparedness',
   'Civil Defence Emergency Plan — reviewed and up to date', 12,
   'Must align with local Civil Defence Group plan. Review after any civil defence exercise or event.'),

  ('emergency_preparedness',
   'Emergency contact list — trustees, key community members, Civil Defence coordinator', 6,
   'Include cell numbers, alternative contacts, and local Civil Defence coordinator details.'),

  ('emergency_preparedness',
   'Generator — tested, fuelled, serviced', 3,
   'Test under load monthly. Fuel stabiliser if stored long-term. Log every test run.'),

  ('emergency_preparedness',
   'Water supply — 10,000L tank or alternative checked', 6,
   'Inspect tank for leaks, contamination, and pump operation. Confirm potability.'),

  ('emergency_preparedness',
   'Emergency food and supply kit — stocked and checked', 6,
   'Check expiry dates on food and medications. Minimum 72-hour supply for likely occupancy.'),

  ('emergency_preparedness',
   'Community welfare register — vulnerable whānau who need checking on', 12,
   'List of kaumātua, disabled whānau, and others who may need welfare checks during an emergency. Keep private and current.'),

  ('emergency_preparedness',
   'First aid kit — stocked and in date', 6,
   'Check all consumables for expiry. Restock after any use. Ensure AED pads/battery checked if applicable.'),

  ('emergency_preparedness',
   'Evacuation routes — identified and communicated to committee', 12,
   'Post maps in the marae. Brief all trustees and key volunteers. Include accessibility routes.'),

  ('emergency_preparedness',
   'Emergency communications plan — contact community if power/internet down', 12,
   'Document the plan: phone trees, community radio channel, meeting point. Test annually.'),

  ('emergency_preparedness',
   'Marae structure — roof, walls, foundations checked for storm readiness', 6,
   'Visual inspection after major weather events. Engage qualified builder for structural assessment annually.')
) as v(category, name, renewal_months, notes)
where not exists (
  select 1 from compliance_items where category = 'emergency_preparedness'
);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEED DATA — WORKFLOW TEMPLATES
-- ═════════════════════════════════════════════════════════════════════════════
-- These template names are referenced by the keyword-matching logic in
-- workflowEngine.js. Add steps via the Workflow Engine UI after setup.

insert into workflow_templates (name, category, is_active)
values
  ('Building Maintenance and Repair', 'maintenance', true),
  ('Heat Pump Service',               'maintenance', true),
  ('Fire Safety Compliance Check',    'compliance',  true),
  ('Marae Insurance Renewal',         'compliance',  true),
  ('Facility Hire Agreement',         'bookings',    true)
on conflict do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ═════════════════════════════════════════════════════════════════════════════
-- Create these via the Supabase dashboard (Storage → New bucket) or run the
-- SQL below. Two buckets are used:
--   • documents     — general uploaded files (PDFs, DOCX, images)
--   • compliance-docs — compliance item and incident attachments
--
-- insert into storage.buckets (id, name, public) values
--   ('documents',      'documents',      true),
--   ('compliance-docs','compliance-docs', true)
-- on conflict (id) do nothing;
--
-- create policy "documents storage: authenticated upload"
--   on storage.objects for insert to authenticated
--   with check (bucket_id in ('documents','compliance-docs'));
--
-- create policy "documents storage: public read"
--   on storage.objects for select
--   using (bucket_id in ('documents','compliance-docs'));
--
-- create policy "documents storage: authenticated delete"
--   on storage.objects for delete to authenticated
--   using (bucket_id in ('documents','compliance-docs'));


-- ═════════════════════════════════════════════════════════════════════════════
-- SCHEDULED FUNCTIONS (pg_cron — configure after deploying Edge Functions)
-- ═════════════════════════════════════════════════════════════════════════════
-- Replace <PROJECT_REF> with your new sandbox project's reference ID.
-- Run AFTER: deploying check-deadlines and notify-trustees Edge Functions,
-- and setting app.service_role_key and RESEND_API_KEY.
--
-- alter database postgres set app.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
--
-- select cron.schedule(
--   'maraehub-check-deadlines',
--   '0 8 * * *',
--   $$ select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-deadlines',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
--     body    := '{}'::jsonb
--   ); $$
-- );
--
-- select cron.schedule(
--   'maraehub-notify-trustees',
--   '0 20 * * *',
--   $$ select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-trustees',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
--     body    := '{}'::jsonb
--   ); $$
-- );
