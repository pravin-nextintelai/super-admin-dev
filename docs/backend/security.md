# Security & privacy

## Transport / headers
- `helmet` on every response (HSTS, nosniff, frame deny, referrer policy, DNS-prefetch off, `x-powered-by` removed). CSP is disabled because the service only returns JSON/CSV/PDF; CORP is `cross-origin` so the portal can download PDFs.
- `trust proxy = 1` so `req.ip`, rate limits and HTTPS detection are correct behind Cloud Run / load balancers.

## CORS
- Admin API: explicit allow-list (`src/app.js` `DEFAULT_ALLOWED_ORIGINS` + `CORS_ALLOWED_ORIGINS`), credentials allowed. Unknown origins are rejected.
- Public website intake (`/api/public/*`) carries its own narrower CORS (`CONTACT_FORM_ALLOWED_ORIGINS`, `NEWSLETTER_FORM_ALLOWED_ORIGINS`, `PROMO_ALLOWED_ORIGINS`) and per-IP rate limits.

## Authentication & authorization
- Dashboard JWT (`JWT_SECRET`, 24 h) verified by `shared/middleware/authMiddleware.js`; every admin router declares `authorize([...roles])`.
- Roles: super-admin, user-admin, account-admin, finance-admin, marketing-admin, support-admin. Referral attribution is write-once (`409 REFERRAL_ALREADY_SET`).
- `POST /api/auth/*` is rate-limited per client IP (`AUTH_RATE_LIMIT_MAX` per `AUTH_RATE_LIMIT_WINDOW_MS`, default 60 / 10 min).

## Data handling
- Request/response logs redact any field whose key matches password / token / secret / otp / authorization / api key / signature / cookie / session / credential / card (`shared/utils/logging.utils.js`). Previously the login body (including the password) was written to logs.
- JSON bodies capped (`JSON_BODY_LIMIT`, default 1 MB). File uploads go through multer with explicit limits in their routers.
- Money is handled as integer paise (`shared/utils/money.js`); never floats.
- Reconciliation never mutates `payments`; findings live in `reconciliation_*` tables with an immutable history.
- Secrets live only in `.env` (git-ignored) or Cloud Run secrets; `.env.example` lists keys without values. `infra/terraform/terraform.tfstate` is git-ignored going forward (it may contain secrets — rotate anything it exposed).

## Known gaps / next steps
- The Razorpay keys currently in `.env` are rejected by Razorpay (401); live reconciliation needs valid read keys.
- Consider moving the in-memory rate limiters to Redis when running more than one instance.
- Add SAST/dependency scanning (`npm audit`, Dependabot) to `.github/workflows/ci.yml`.
