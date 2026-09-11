-- Newsletter subscribers captured from the Jurinex website form.
-- Target: Auth / Main DB (same pool as contact_enquiries).
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL,
  ip_address      VARCHAR(64),
  browser         VARCHAR(128),
  os              VARCHAR(128),
  device_type     VARCHAR(32),
  user_agent      TEXT,
  source          VARCHAR(64) NOT NULL DEFAULT 'website_newsletter',
  page_url        TEXT,
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_newsletter_subscribers_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_subscribed_at
  ON newsletter_subscribers (subscribed_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_ip
  ON newsletter_subscribers (ip_address);
