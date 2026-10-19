# JuriNex Super Admin — Frontend

React 18 + Vite + Tailwind. Feature-based layout; every feature owns its pages, components and API module.

```bash
cp .env.example .env.local   # optional overrides
npm ci
npm run dev                  # http://localhost:3001 (proxies /api → backend on :4000)
npm run lint
npm run build                # → dist/ (deployed by Netlify, see netlify.toml)
```

```
src/
├── app/            main.jsx (entry) · App.jsx (<Routes> tree) · routes.jsx (role homes + route guards)
├── config/         config.js — API base URL, auth headers, customer app URLs
├── shared/         api.js (fetch helper + envelope) · components/ · utils/ (debugLogger)
├── features/       auth · dashboard · users · finance · subscriptions · support · marketing · settings
│                   documents · templates · ai-management · citations · judgements · jurinex-voice · sales-referrals
│                   each: pages/ · components/ · <feature>Api.js (+ hooks/, dialogs/, utils/ where needed)
├── assets/ · styles/ (index.css, global.css)
tests/              (see tests/README.md)
```

Backend API reference: [docs/backend/API_REFERENCE.md](../docs/backend/API_REFERENCE.md). Role matrix: [docs/ADMIN_ROLES.md](../docs/ADMIN_ROLES.md).
