/**
 * Public website header offers / events.
 * Mounted at /api/public/promos BEFORE portal CORS so jurinex.ai can GET the bar.
 *
 *   GET  /api/public/promos/header
 *   GET  /api/public/promos
 *   POST /api/public/promos/:id/book
 */
const express = require('express');
const cors = require('cors');
const requestIdMiddleware = require('../middleware/requestId.middleware');
const { createIpRateLimiter } = require('../middleware/publicRateLimit.middleware');
const { makeControllers } = require('../controllers/marketingPromoController');

const DEFAULT_ORIGINS = [
  'https://jurinex.ai',
  'https://www.jurinex.ai',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

function allowedOrigins() {
  const raw = String(process.env.CONTACT_FORM_ALLOWED_ORIGINS || process.env.PROMO_ALLOWED_ORIGINS || '').trim();
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
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-Id'],
      credentials: false,
      maxAge: 600,
    })
  );
  r.use(express.json({ limit: '32kb' }));
  r.use(requestIdMiddleware);

  const limiter = createIpRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: Number.parseInt(process.env.PROMO_BOOK_RATE_LIMIT || '20', 10) || 20,
    name: 'public-promo',
  });

  r.get('/health', (_req, res) => res.json({ success: true, service: 'promos', timezone: 'Asia/Kolkata' }));
  r.get('/header', ctrl.getHeader);
  r.get('/', ctrl.listPublic);
  r.post('/:id/book', limiter, ctrl.bookPublic);

  r.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API Endpoint Not Found' } }));
  return r;
};

module.exports = router;
