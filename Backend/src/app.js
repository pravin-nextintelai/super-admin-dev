/**
 * Express application factory — middleware, security headers, CORS and route mounting.
 * No business logic lives here; see src/routes/v1/index.js for the route table.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const requestIdMiddleware = require('./infrastructure/observability/requestId');
const errorMiddleware = require('./shared/middleware/errorHandler');
const tenantContext = require('./shared/middleware/tenantContext');
const { createIpRateLimiter } = require('./shared/middleware/rateLimiter');
const { publicRoutes, apiRoutes, mountAll, toV1 } = require('./routes/v1');

/** Portal origins allowed to call the admin API (extend with CORS_ALLOWED_ORIGINS="https://a,https://b"). */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:4000',
  'https://nexintel-super-admin.netlify.app',
  'https://super-admin-dev.netlify.app',
];

function allowedOrigins() {
  const extra = String(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra])];
}

/**
 * @param {object} pools  { pool, docPool, draftPool, paymentPool, citationPool, citationAnalyticsPool }
 * @param {object} [opts] { log: (line) => void }
 */
function createApp(pools, { log = console.log } = {}) {
  const app = express();

  // Behind Cloud Run / load balancers: trust the first proxy so req.ip and rate limits see the client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Security headers. The API serves JSON/CSV/PDF only; CORP is relaxed so the portal can fetch PDFs cross-origin.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  // Liveness probe (no DB access, no auth).
  app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

  // --- Public website intake (no auth) ---
  // Mounted BEFORE the portal CORS allow-list: each router carries its own CORS config (e.g. CONTACT_FORM_ALLOWED_ORIGINS)
  // so the public website can POST a form without gaining access to any admin route.
  mountAll(app, publicRoutes(pools), { log });

  // --- CORS (portal) ---
  const origins = allowedOrigins();
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin)) callback(null, true);
      else callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }));

  // --- Body parsing + request logging (bodies are redacted in logs; see shared/utils/logging.utils.js) ---
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
  app.use(requestIdMiddleware);
  app.use(tenantContext);

  // --- Brute-force protection on login (per client IP, in-memory) ---
  const authLimiter = createIpRateLimiter({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
    name: 'auth',
  });
  app.post(['/api/auth/*splat', toV1('/api/auth') + '/*splat'], authLimiter);

  log('\n' + '='.repeat(60));
  log('🔧 INITIALIZING ROUTES WITH DATABASE CONNECTIONS');
  log('='.repeat(60));
  mountAll(app, apiRoutes(pools), { log });
  log('='.repeat(60) + '\n');

  // --- 404 ---
  app.use((req, res) => res.status(404).json({ message: 'API Endpoint Not Found' }));

  // --- Centralized error handler (must be last) ---
  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp, allowedOrigins };
