-- Adds the fields needed to generate and track a customer invoice for a
-- booking's hire fee, built on the existing finance_income row that's
-- auto-created when a booking is approved.

alter table bookings
  add column if not exists contact_email text;

alter table finance_income
  add column if not exists invoice_sent_at timestamptz,
  add column if not exists invoice_paid_at timestamptz;

alter table marae_settings
  add column if not exists payment_details text;
