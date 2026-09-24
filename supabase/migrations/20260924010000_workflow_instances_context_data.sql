-- Generic Role Setup (Settings > Trustee Permissions "Role Setup" modal):
-- workflow_instances has nowhere to hold a small piece of user-entered
-- context captured when a workflow starts -- e.g. Secretary Role Setup's
-- "how often does your marae meet?" input, used to set the real cadence
-- of the recurring "Take Hui Minutes" duty instead of the previous
-- hardcoded monthly value. Deliberately generic (not a
-- "meeting_frequency" column) so any future role-setup workflow can
-- store its own small inputs here too, without another migration.

alter table public.workflow_instances add column if not exists context_data jsonb;
