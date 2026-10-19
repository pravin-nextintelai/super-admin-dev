# JuriNex Super Admin — Backend

Express 5 / Node 20 API behind the admin portal. Modular layout under `src/`, every route available at its legacy path **and** under `/api/v1`.

```bash
cp .env.example .env   # fill in
npm ci
npm run dev            # http://localhost:4000
npm run lint
npm test
```

| Doc | What |
|---|---|
| [docs/backend/architecture.md](../docs/backend/architecture.md) | folder layout, request lifecycle, versioning |
| [docs/backend/module-ownership.md](../docs/backend/module-ownership.md) | which module owns which routes/tables |
| [docs/backend/API_REFERENCE.md](../docs/backend/API_REFERENCE.md) | every endpoint (legacy + v1) · [mount table](../docs/backend/api-documentation.md) |
| [docs/backend/database.md](../docs/backend/database.md) | pools, tables, migrations |
| [docs/backend/security.md](../docs/backend/security.md) | headers, CORS, auth, log redaction, secrets |
| [docs/backend/deployment.md](../docs/backend/deployment.md) | local, Docker, Cloud Run, CI |

Entry point: `server.js` → `src/server.js` (bootstrap) → `src/app.js` (middleware + `src/routes/v1/index.js`).
