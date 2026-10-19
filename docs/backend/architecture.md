# Backend architecture

Node 20 · Express 5 · PostgreSQL (`pg` + a few Sequelize models) · Google Cloud (GCS, Document AI, Gemini) · Razorpay (read-only).

```
Backend/
├── src/
│   ├── server.js                 env validation, DB pools, HTTP listen, schema bootstrap, jobs, graceful shutdown
│   ├── app.js                    Express factory: helmet, CORS allow-list, JSON limit, request-id log, tenant context, auth rate limit, routes, 404, error handler
│   ├── config/                   env.js · database.js (lazy pool facade) · gcs.js · ai.js · payment.js · logger.js
│   ├── modules/<domain>/         <name>.routes.js · <name>.controller.js · <name>.service.js · <name>.repository.js · <name>.model.js (flat, one folder per domain)
│   │   └── jurinex-voice/        agents · calls · calendar · scheduler · tools · voices · postcall · kb · models · tests · voice.routes.js · index.js
│   ├── shared/
│   │   ├── middleware/           authenticate.js · authorize.js · tenantContext.js · rateLimiter.js · validateRequest.js · errorHandler.js (+ adminAuth.js, adminApiKey.js, upload.js)
│   │   ├── errors/ApiError.js    constants/roles.js    utils/ (money, time, csv, pagination, logging redaction…)    validators/
│   ├── infrastructure/
│   │   ├── database/             sequelize.js · connections/ (one file per PostgreSQL pool) · modelRegistry.js · bootstrap.js
│   │   ├── storage/gcs/          GCS helpers (admin uploads, voice assets)
│   │   ├── ai-providers/         gemini.js · providerRegistry.js
│   │   ├── email/ · payments/razorpayClient.js · queue/ · observability/ (requestId, voice/dataflow loggers)
│   ├── routes/v1/index.js        THE route table — every router at its legacy path AND /api/v1/…
│   └── jobs/                     index.js (registry) · workers/ · schedules/
├── database/migrations/          SQL + run_*.js runners (incl. jurinex-voice/)   database/seeders/   database/README.md
├── templates/email|invoices|notifications/
├── tests/integration|e2e|contract|fixtures/
├── infra/terraform/ · scripts/ · .github/{CODEOWNERS,workflows}
├── .env.example · .gitignore · .dockerignore · Dockerfile · docker-compose.yml · eslint.config.js · package.json · README.md
└── server.js                     1-line entry shim → src/server.js
```
Documentation lives in the repository-level docs site: `docs/backend/*` (this folder).

## Request lifecycle
1. `helmet` security headers, `trust proxy` (Cloud Run), `/healthz` liveness.
2. Public website intake routers (`/api/public/*`) — mounted first, each with its own CORS + IP rate limit.
3. Portal CORS allow-list (`CORS_ALLOWED_ORIGINS` adds to the built-in list) → `express.json` (`JSON_BODY_LIMIT`) → request-id + structured logging (sensitive fields redacted) → tenant context (`X-Tenant-Id`).
4. Login brute-force limiter on `POST /api/auth/*` and `/api/v1/auth/*`.
5. Route table, then JSON 404, then the central error handler.

## Versioning
Every router is mounted twice in the same order: legacy path (e.g. `/api/admin/users-plans`) and versioned path (`/api/v1/admin/users-plans`). Nothing that existed before the restructure changed path, method, payload or behaviour. New clients should use `/api/v1`. Full endpoint list: [API_REFERENCE.md](API_REFERENCE.md).

## Databases
One `pg` pool per database (`src/infrastructure/database/connections/*`), exposed lazily by `src/config/database.js`. Sequelize is used only for the template and support models (registered in `modelRegistry.js`, synced at startup as before). Schema bootstrap for prompt/LLM/support/AI-document tables runs after the port is open (`bootstrap.js`); marketing, referrals and reconciliation apply their own idempotent SQL from `database/migrations/`.

## Module map
See [module-ownership.md](module-ownership.md).
