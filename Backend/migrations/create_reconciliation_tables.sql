-- Razorpay ↔ Payment DB reconciliation (Payment DB / PAYMENT_DB_URL).
-- Additive only. Original payment rows are never modified by reconciliation; everything lives in these tables.
-- Applied automatically at startup by services/reconciliationService.ensureReconciliationSchema(), or run manually:
--   psql "$PAYMENT_DB_URL" -f migrations/create_reconciliation_tables.sql

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id                        SERIAL PRIMARY KEY,
  range_start               DATE        NOT NULL,                 -- IST calendar day, inclusive
  range_end                 DATE        NOT NULL,                 -- IST calendar day, inclusive
  from_ts                   TIMESTAMPTZ NOT NULL,                 -- resolved UTC start (>=)
  to_ts_exclusive           TIMESTAMPTZ NOT NULL,                 -- resolved UTC end (<)
  razorpay_from_unix        BIGINT      NOT NULL,
  razorpay_to_unix          BIGINT      NOT NULL,                 -- inclusive, = to_ts_exclusive - 1s
  status                    VARCHAR(32) NOT NULL DEFAULT 'queued', -- queued|running|completed|completed_with_issues|partial|failed
  requested_by              INTEGER,
  requested_by_email        VARCHAR(255),
  attempt                   INTEGER     NOT NULL DEFAULT 1,
  retry_of_run_id           INTEGER     REFERENCES reconciliation_runs(id) ON DELETE SET NULL,
  started_at                TIMESTAMPTZ,
  finished_at               TIMESTAMPTZ,
  razorpay_pages_fetched    INTEGER     NOT NULL DEFAULT 0,
  razorpay_payments_fetched INTEGER     NOT NULL DEFAULT 0,
  razorpay_fetch_complete   BOOLEAN     NOT NULL DEFAULT false,
  db_rows_loaded            INTEGER     NOT NULL DEFAULT 0,
  db_load_complete          BOOLEAN     NOT NULL DEFAULT false,
  api_calls                 INTEGER     NOT NULL DEFAULT 0,
  api_retries               INTEGER     NOT NULL DEFAULT 0,
  summary                   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  error                     TEXT,
  error_details             JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recon_runs_created ON reconciliation_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recon_runs_status  ON reconciliation_runs (status);

-- Snapshot of every Razorpay payment returned by the API for a run (audit trail; raw payload kept).
CREATE TABLE IF NOT EXISTS reconciliation_razorpay_payments (
  id                     SERIAL PRIMARY KEY,
  run_id                 INTEGER     NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  razorpay_payment_id    VARCHAR(64) NOT NULL,
  razorpay_order_id      VARCHAR(64),
  razorpay_invoice_id    VARCHAR(64),
  amount_paise           BIGINT,
  amount_refunded_paise  BIGINT,
  currency               VARCHAR(8),
  status                 VARCHAR(32),
  refund_status          VARCHAR(32),
  captured               BOOLEAN,
  method                 VARCHAR(32),
  email                  VARCHAR(255),
  contact                VARCHAR(64),
  razorpay_created_at    TIMESTAMPTZ,
  order_receipt          VARCHAR(255),
  notes                  JSONB,
  payload                JSONB       NOT NULL,
  order_payload          JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, razorpay_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_recon_rzp_payment ON reconciliation_razorpay_payments (razorpay_payment_id);

CREATE TABLE IF NOT EXISTS reconciliation_issues (
  id                   SERIAL PRIMARY KEY,
  run_id               INTEGER     NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  issue_type           VARCHAR(48) NOT NULL,   -- RAZORPAY_ONLY, DB_ONLY, DUPLICATE_REFERENCE, AMOUNT_MISMATCH, CURRENCY_MISMATCH,
                                               -- STATUS_MISMATCH, ORDER_MISMATCH, REFUND_MISMATCH, TAX_BREAKDOWN_MISMATCH,
                                               -- MISSING_INVOICE, INCOMPLETE_RECORD
  severity             VARCHAR(16) NOT NULL DEFAULT 'medium', -- info|low|medium|high|critical
  status               VARCHAR(16) NOT NULL DEFAULT 'open',   -- open|resolved
  razorpay_payment_id  VARCHAR(64),
  razorpay_order_id    VARCHAR(64),
  source_table         VARCHAR(64),            -- payments | user_token_topup_purchases | user_storage_addon_purchases
  source_id            INTEGER,
  user_id              INTEGER,
  message              TEXT,
  expected             JSONB,
  actual               JSONB,
  details              JSONB,
  resolved_by          INTEGER,
  resolved_by_email    VARCHAR(255),
  resolved_at          TIMESTAMPTZ,
  resolution_reason    TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recon_issues_run_status ON reconciliation_issues (run_id, status);
CREATE INDEX IF NOT EXISTS idx_recon_issues_type       ON reconciliation_issues (issue_type);
CREATE INDEX IF NOT EXISTS idx_recon_issues_payment    ON reconciliation_issues (razorpay_payment_id);

-- Immutable audit trail of every state change on an issue.
CREATE TABLE IF NOT EXISTS reconciliation_issue_history (
  id              SERIAL PRIMARY KEY,
  issue_id        INTEGER     NOT NULL REFERENCES reconciliation_issues(id) ON DELETE CASCADE,
  action          VARCHAR(16) NOT NULL,        -- created|resolved|reopened
  previous_status VARCHAR(16),
  new_status      VARCHAR(16),
  reason          TEXT,
  admin_id        INTEGER,
  admin_email     VARCHAR(255),
  snapshot        JSONB,                       -- issue row as it was before the change
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recon_issue_history_issue ON reconciliation_issue_history (issue_id, created_at);

-- Execution log per run: API pages, retries, failures, phase transitions.
CREATE TABLE IF NOT EXISTS reconciliation_run_events (
  id          SERIAL PRIMARY KEY,
  run_id      INTEGER     NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  level       VARCHAR(8)  NOT NULL DEFAULT 'info',  -- info|warn|error
  phase       VARCHAR(32),
  message     TEXT        NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recon_run_events_run ON reconciliation_run_events (run_id, created_at);
