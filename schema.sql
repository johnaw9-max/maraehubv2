-- ─────────────────────────────────────────────────────────────────────────────
-- MaraeHub — Complete Database Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this entire file in the Supabase SQL editor to initialise a fresh project.
-- Tables are ordered by dependency (referenced tables first).
-- All tables have RLS enabled; policies grant full access to authenticated users.
-- Tighten policies per-table if finer-grained access control is required.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- Auth-backed users. id must match a row in auth.users (created by signUp).
-- The app inserts here manually after supabase.auth.signUp(); see the optional
-- trigger at the bottom of this file to automate that.

create table if not exists profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  role       text        not null default 'community'
                         check (role in ('trustee', 'community')),
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: authenticated full access"
  on profiles for all
  to authenticated
  using (true)
  with check (true);


-- ── CONTACTS ──────────────────────────────────────────────────────────────────
-- Community members stored without a Supabase auth account.
-- profiles.id is a FK to auth.users, so no-email contacts live here instead.

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


-- ── CONTRACTORS ───────────────────────────────────────────────────────────────

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


-- ── MARAE_SETTINGS ────────────────────────────────────────────────────────────
-- Single-row table. The app uses .limit(1).single() and upserts on the one row.

create table if not exists marae_settings (
  id         uuid        primary key default gen_random_uuid(),
  marae_name text        not null default '',
  location   text,
  iwi        text,
  hapu       text,
  phone      text,
  email      text,
  website    text,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table marae_settings enable row level security;

create policy "marae_settings: authenticated full access"
  on marae_settings for all
  to authenticated
  using (true)
  with check (true);


-- ── CHECKLIST_TEMPLATES ───────────────────────────────────────────────────────
-- Reusable exit-checklist items managed in Settings. Copied into booking_checklists
-- at the time a checklist is started for a booking.

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


-- ── BLOCKED_DATES ─────────────────────────────────────────────────────────────
-- Date ranges trustees mark as unavailable on the calendar.

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


-- ── BOOKINGS ──────────────────────────────────────────────────────────────────
-- Venue booking requests submitted by community members or trustees.
-- reference format: 'MH-YYYY-XXXX' (generated by the app, not the DB).
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


-- ── BOOKING_CHECKLISTS ────────────────────────────────────────────────────────
-- One per booking. items is a jsonb array of checklist item objects:
-- [{ "id": uuid, "label": text, "checked": bool, "notes": text }, ...]
-- Seeded from checklist_templates when a checklist is first opened.

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


-- ── BOOKING_FEEDBACK ──────────────────────────────────────────────────────────
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


-- ── NOTICES ───────────────────────────────────────────────────────────────────

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


-- ── DOCUMENTS ─────────────────────────────────────────────────────────────────
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


-- ── PROJECTS ──────────────────────────────────────────────────────────────────
-- subtasks is a jsonb array of sub-task objects:
-- [{ "id": uuid, "title": text, "assigned_to": text, "due_date": date,
--    "priority": "High"|"Medium"|"Low", "status": text, "created_at": timestamptz }, ...]

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


-- ── TASKS ─────────────────────────────────────────────────────────────────────

create table if not exists tasks (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  description  text,
  assigned_to  text,
  due_date     date,
  priority     text        not null default 'Medium'
                           check (priority in ('High','Medium','Low')),
  status       text        not null default 'open'
                           check (status in ('open','in-progress','completed','cancelled')),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_tasks_status   on tasks(status);
create index if not exists idx_tasks_due_date on tasks(due_date);

alter table tasks enable row level security;

create policy "tasks: authenticated full access"
  on tasks for all
  to authenticated
  using (true)
  with check (true);


-- ── GRANTS ────────────────────────────────────────────────────────────────────

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


-- ── ASSETS ────────────────────────────────────────────────────────────────────

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


-- ── SERVICE_REMINDERS ─────────────────────────────────────────────────────────
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
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_reminders_asset_id on service_reminders(asset_id);
create index if not exists idx_service_reminders_due_date on service_reminders(due_date);

alter table service_reminders enable row level security;

create policy "service_reminders: authenticated full access"
  on service_reminders for all
  to authenticated
  using (true)
  with check (true);


-- ── MEETINGS ──────────────────────────────────────────────────────────────────
-- Committee / trustee meeting records. Resolutions and actions are child tables.

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


-- ── RESOLUTIONS ───────────────────────────────────────────────────────────────

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


-- ── MEETING_ACTIONS ───────────────────────────────────────────────────────────

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


-- ── FEEDBACK ──────────────────────────────────────────────────────────────────
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
-- STORAGE BUCKET
-- ─────────────────────────────────────────────────────────────────────────────
-- The 'documents' bucket stores uploaded files (PDFs, DOCX, images, etc.).
-- Create via the Supabase dashboard (Storage → New bucket, name: documents,
-- Public: true) or with the SQL below (requires service role / superuser):
--
-- insert into storage.buckets (id, name, public)
-- values ('documents', 'documents', true)
-- on conflict (id) do nothing;
--
-- create policy "documents storage: authenticated upload"
--   on storage.objects for insert
--   to authenticated
--   with check (bucket_id = 'documents');
--
-- create policy "documents storage: public read"
--   on storage.objects for select
--   using (bucket_id = 'documents');
--
-- create policy "documents storage: authenticated delete"
--   on storage.objects for delete
--   to authenticated
--   using (bucket_id = 'documents');


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL: AUTH TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-creates a profiles row whenever a new user signs up via Supabase Auth.
-- Without this the app inserts the row manually after auth.signUp().
--
-- create or replace function public.handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer set search_path = public
-- as $$
-- begin
--   insert into public.profiles (id, full_name, email, role)
--   values (
--     new.id,
--     coalesce(new.raw_user_meta_data->>'full_name', ''),
--     new.email,
--     'community'
--   )
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $$;
--
-- create or replace trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();
