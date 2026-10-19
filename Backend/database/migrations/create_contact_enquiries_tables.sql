-- ============================================================================
-- Contact enquiries ("Contact Jurinex" form on jurinex.ai)
-- ----------------------------------------------------------------------------
-- Lives in the Auth / Main DB (DATABASE_URL) next to demo_bookings.
-- Worked by Marketing Admin in the Super Admin portal.
--
-- All timestamps are TIMESTAMPTZ (stored as UTC). The API renders every
-- timestamp in IST (Asia/Kolkata) alongside the raw UTC value.
--
-- Idempotent: safe to re-run (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_enquiries (
  id                    SERIAL PRIMARY KEY,
  reference_no          VARCHAR(32) UNIQUE,                 -- CE-YYYYMMDD-00001 (IST date)

  -- What the visitor typed in the form
  first_name            VARCHAR(100) NOT NULL,              -- "Name"
  last_name             VARCHAR(100) NOT NULL DEFAULT '',   -- "Surname"
  email                 VARCHAR(255) NOT NULL,
  mobile_number         VARCHAR(32)  NOT NULL,
  organisation_name     VARCHAR(255),                       -- optional
  topic                 VARCHAR(64),                        -- "What is this about" (optional)
  message               TEXT,                               -- "Additional details" (optional)
  marketing_consent     BOOLEAN NOT NULL DEFAULT FALSE,     -- promo calls / SMS / WhatsApp / email opt-in
  consent_given_at      TIMESTAMPTZ,

  -- Where it came from
  source                VARCHAR(64) NOT NULL DEFAULT 'website_contact_form',
  page_url              TEXT,
  ip_address            VARCHAR(64),
  user_agent            TEXT,

  -- Marketing workflow
  status                VARCHAR(24) NOT NULL DEFAULT 'new',
  priority              VARCHAR(16) NOT NULL DEFAULT 'normal',
  assigned_to           INTEGER,                            -- super_admins.id (no FK: admins may be deleted)
  first_contacted_at    TIMESTAMPTZ,                        -- when the team first reached out
  first_contacted_by    INTEGER,                            -- super_admins.id
  last_contacted_at     TIMESTAMPTZ,
  last_contacted_by     INTEGER,
  last_contact_channel  VARCHAR(24),                        -- call | email | whatsapp | sms | meeting | other
  contact_attempts      INTEGER NOT NULL DEFAULT 0,
  status_changed_at     TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- submission time (UTC; shown as IST)
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_contact_enquiries_status
    CHECK (status IN ('new', 'contacted', 'in_progress', 'converted', 'closed', 'spam')),
  CONSTRAINT chk_contact_enquiries_priority
    CHECK (priority IN ('low', 'normal', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_created_at   ON contact_enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_enquiries_status       ON contact_enquiries (status);
CREATE INDEX IF NOT EXISTS idx_contact_enquiries_topic        ON contact_enquiries (topic);
CREATE INDEX IF NOT EXISTS idx_contact_enquiries_assigned_to  ON contact_enquiries (assigned_to);
CREATE INDEX IF NOT EXISTS idx_contact_enquiries_email_lower  ON contact_enquiries (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_contact_enquiries_mobile       ON contact_enquiries (mobile_number);

-- ----------------------------------------------------------------------------
-- Activity timeline: every submission, status / priority / assignment change,
-- logged contact attempt, and internal note.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_enquiry_activities (
  id              SERIAL PRIMARY KEY,
  enquiry_id      INTEGER NOT NULL REFERENCES contact_enquiries(id) ON DELETE CASCADE,
  activity_type   VARCHAR(32) NOT NULL,   -- submitted | status_changed | priority_changed | assigned | contact_logged | note_added
  from_value      VARCHAR(128),
  to_value        VARCHAR(128),
  channel         VARCHAR(24),            -- for contact_logged
  outcome         VARCHAR(32),            -- for contact_logged
  note            TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- when the contact actually happened (may be back-dated)
  actor_admin_id  INTEGER,                -- super_admins.id, NULL for system / static admin token
  actor_email     VARCHAR(255),
  actor_role      VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_enquiry_activities_enquiry
  ON contact_enquiry_activities (enquiry_id, created_at DESC);
