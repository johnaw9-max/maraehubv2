-- Notification preferences on profiles — each trustee controls what they receive.
-- Defaults to all enabled. Set individual keys to false to opt out.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL
  DEFAULT '{"bookings":true,"compliance":true,"grants":true,"actions":true,"goals":true}'::jsonb;

-- Notification log — prevents duplicate sends.
-- entity_id is text (not FK) because it references different tables.
-- entity_key is an optional discriminator (e.g. goal status value).
CREATE TABLE IF NOT EXISTS notification_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text        NOT NULL,
  entity_id         text        NOT NULL,
  entity_key        text,
  trustee_id        uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_lookup
  ON notification_log (notification_type, entity_id, trustee_id, sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to notification_log" ON notification_log
  FOR ALL USING (true) WITH CHECK (true);
