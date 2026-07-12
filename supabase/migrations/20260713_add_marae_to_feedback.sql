-- Add marae name to feedback so submissions are identifiable when viewed
-- across multiple marae projects (e.g. from the Founder Dashboard).

alter table feedback add column if not exists marae text;
