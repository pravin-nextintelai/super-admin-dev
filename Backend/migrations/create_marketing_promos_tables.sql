-- Marketing offers & events shown on the Jurinex website header bar.
-- Target: Auth / Main DB. Idempotent.

CREATE TABLE IF NOT EXISTS marketing_promos (
  id                 SERIAL PRIMARY KEY,
  kind               VARCHAR(16) NOT NULL CHECK (kind IN ('offer', 'event')),
  status             VARCHAR(16) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'active', 'paused')),
  badge              VARCHAR(64),
  title              VARCHAR(255) NOT NULL,
  subtitle           TEXT,
  cta_label          VARCHAR(64),
  cta_url            TEXT,
  background_color   VARCHAR(32) NOT NULL DEFAULT '#0F766E',
  text_color         VARCHAR(32) NOT NULL DEFAULT '#FFFFFF',
  show_on_header     BOOLEAN NOT NULL DEFAULT TRUE,
  priority           INTEGER NOT NULL DEFAULT 0,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  location           VARCHAR(255),
  created_by         INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_promos_header
  ON marketing_promos (show_on_header, status, priority DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_promos_window
  ON marketing_promos (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS marketing_promo_slots (
  id              SERIAL PRIMARY KEY,
  promo_id        INTEGER NOT NULL REFERENCES marketing_promos(id) ON DELETE CASCADE,
  label           VARCHAR(128),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  seat_capacity   INTEGER,
  seats_booked    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_marketing_promo_slots_seats CHECK (seats_booked >= 0),
  CONSTRAINT ck_marketing_promo_slots_cap CHECK (seat_capacity IS NULL OR seat_capacity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_marketing_promo_slots_promo
  ON marketing_promo_slots (promo_id, starts_at);

CREATE TABLE IF NOT EXISTS marketing_promo_bookings (
  id           SERIAL PRIMARY KEY,
  promo_id     INTEGER NOT NULL REFERENCES marketing_promos(id) ON DELETE CASCADE,
  slot_id      INTEGER REFERENCES marketing_promo_slots(id) ON DELETE SET NULL,
  email        VARCHAR(255),
  name         VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_promo_bookings_promo
  ON marketing_promo_bookings (promo_id, created_at DESC);
