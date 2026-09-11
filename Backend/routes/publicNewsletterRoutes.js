/**
 * Public intake for the website newsletter form.
 * Mounted at /api/public/newsletter (see server.js) BEFORE the portal CORS allow-list.
 *
 *   POST /api/public/newsletter        → save subscriber (no auth, rate-limited, honeypot)
 *   GET  /api/public/newsletter/health → liveness for the website form
 *
 * Env:
 *   CONTACT_FORM_ALLOWED_ORIGINS  reused for newsletter (jurinex.ai + localhost)
 *   NEWSLETTER_FORM_RATE_LIMIT    max submissions per IP per 10 minutes (default 8)
 */
const express = require('express');
const cors = require('cors');
const requestIdMiddleware = require('../middleware/requestId.middleware');
const { createIpRateLimiter } = require('../middleware/publicRateLimit.middleware');
const { makeControllers } = require('../controllers/newsletterSubscriberController');

const DEFAULT_ORIGINS = [
  'https://jurinex.ai',
  'https://www.jurinex.ai',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

function allowedOrigins() {
  const raw = String(process.env.CONTACT_FORM_ALLOWED_ORIGINS || process.env.NEWSLETTER_FORM_ALLOWED_ORIGINS || '').trim();
  if (!raw) return DEFAULT_ORIGINS;
  if (raw === '*') return '*';
  return raw.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

const router = (pool) => {
  const r = express.Router();
  const ctrl = makeControllers(pool);
  const origins = allowedOrigins();

  r.use(
    cors({
      origin: origins === '*' ? true : (origin, cb) => cb(null, !origin || origins.includes(origin)),
      methods: ['POST', 'GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-Id'],
      credentials: false,
      maxAge: 600,
    })
  );
  r.use(express.json({ limit: '32kb' }));
  r.use(express.urlencoded({ extended: false, limit: '32kb' }));
  r.use(requestIdMiddleware);

  const limiter = createIpRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: Number.parseInt(process.env.NEWSLETTER_FORM_RATE_LIMIT || '8', 10) || 8,
    name: 'public-newsletter-form',
  });

  r.get('/health', (_req, res) => res.json({ success: true, service: 'newsletter', timezone: 'Asia/Kolkata' }));
  r.post('/', limiter, ctrl.subscribe);

  r.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API Endpoint Not Found' } }));

  return r;
};

module.exports = router;
