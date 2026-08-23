-- Idempotency table for the Stripe webhook handler (ClickUp 86d43y360,
-- Stage 3). Stripe delivers webhooks at-least-once and retries any
-- non-2xx response for up to ~3 days -- this table is the dedup marker,
-- written only after a real event has been successfully turned into a
-- ClickUp task (or, failing that, a fallback admin email) -- see
-- stripe-webhook/index.ts for why the insert happens after, not before.
--
-- Deliberately locked to service_role only: this table only ever gets
-- touched by the stripe-webhook Edge Function (service role key), and
-- holds real Stripe event/customer identifiers with no legitimate reason
-- for anon or authenticated access.
create table if not exists stripe_webhook_events (
  event_id text not null,
  event_type text not null,
  created_at timestamp with time zone not null default now()
);

alter table stripe_webhook_events add constraint stripe_webhook_events_pkey PRIMARY KEY (event_id);

alter table stripe_webhook_events enable row level security;
