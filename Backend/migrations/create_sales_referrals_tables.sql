-- Sales Referrals (super-admin): sales owners, referral codes, workspace attribution.
-- Target: Auth / Main DB (DATABASE_URL). Idempotent.
--
-- Workspaces in this database are the `firms` table (there is no `tenants` table), so
-- tenant_referrals.tenant_id references firms(id).
-- Admin user ids (super_admins.id) and app user ids (users.id) are INTEGER in this DB.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sales_owners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  internal    BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_by  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  INTEGER,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_owners_name_lower_key
  ON sales_owners (lower(name));

CREATE TABLE IF NOT EXISTS referral_codes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID NOT NULL REFERENCES sales_owners(id),
  code                 VARCHAR(20) NOT NULL,
  label                VARCHAR(60),
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  replaced_by_code_id  UUID REFERENCES referral_codes(id),
  created_by           INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           INTEGER,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_codes_code_format CHECK (code ~ '^[A-Z0-9-]{6,20}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_key
  ON referral_codes (code);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner
  ON referral_codes (owner_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_referrals (
  tenant_id     UUID PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  code_id       UUID REFERENCES referral_codes(id),
  source        VARCHAR(10) NOT NULL CHECK (source IN ('SIGNUP', 'ADMIN')),
  signed_up_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  set_by        INTEGER,
  set_at        TIMESTAMPTZ,
  reason        VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_tenant_referrals_code
  ON tenant_referrals (code_id);

CREATE INDEX IF NOT EXISTS idx_tenant_referrals_signed_up_at
  ON tenant_referrals (signed_up_at);

-- Attribution history: every admin change (A16) keeps the previous and new code.
CREATE TABLE IF NOT EXISTS tenant_referral_history (
  id                SERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL,
  previous_code_id  UUID,
  new_code_id       UUID,
  previous_source   VARCHAR(10),
  reason            VARCHAR(500),
  changed_by        INTEGER,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_referral_history_tenant
  ON tenant_referral_history (tenant_id, changed_at DESC);

-- Attribution history for SOLO lawyer sign-ups (user_referrals is keyed on users.id, an integer,
-- which tenant_referral_history.tenant_id (uuid) cannot hold). user_referrals itself is owned by
-- the user-side auth service and is not created or altered here.
CREATE TABLE IF NOT EXISTS user_referral_history (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  previous_code_id  UUID,
  new_code_id       UUID,
  previous_source   VARCHAR(10),
  reason            VARCHAR(500),
  changed_by        INTEGER,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_referral_history_user
  ON user_referral_history (user_id, changed_at DESC);

-- "Send to email": the sales owner's address, and when/where a code was last emailed (additive, nullable).
ALTER TABLE sales_owners   ADD COLUMN IF NOT EXISTS email            VARCHAR(255);
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS last_emailed_at  TIMESTAMPTZ;
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS last_emailed_to  VARCHAR(255);
