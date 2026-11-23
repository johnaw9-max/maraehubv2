-- Marae Profile (Settings) and Our Marae need seven columns on marae_settings.
-- They were added by hand on Terere on 23 Nov 2026 without a migration file; Test and Opeke do not have them.
-- Additive only: nullable columns with the same defaults Terere uses. Re-running is harmless. No existing data is touched.
alter table public.marae_settings add column if not exists entities jsonb default '[]'::jsonb;
alter table public.marae_settings add column if not exists contacts jsonb default '{}'::jsonb;
alter table public.marae_settings add column if not exists tools_config jsonb default '[]'::jsonb;
alter table public.marae_settings add column if not exists marae_address text;
alter table public.marae_settings add column if not exists marae_phone text;
alter table public.marae_settings add column if not exists sub_committees jsonb default '[]'::jsonb;
alter table public.marae_settings add column if not exists custom_tools jsonb default '[]'::jsonb;
