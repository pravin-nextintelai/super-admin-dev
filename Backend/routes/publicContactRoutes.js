/**
 * Public intake for the "Contact Jurinex" form on jurinex.ai.
 * Mounted at /api/public/contact (see server.js) BEFORE the portal CORS
 * allow-list, so the marketing website can POST here without being able to
 * reach any admin route.
 *
 *   POST /api/public/contact        → save enquiry (no auth, rate-limited, honeypot)
 *   GET  /api/public/contact/health → liveness for the website's form
 *
 * Env:
 *   CONTACT_FORM_ALLOWED_ORIGINS  comma-separated origins ("*" to allow any). Defaults to
 *                                 jurinex.ai + localhost dev ports.
 *   CONTACT_FORM_RATE_LIMIT       max submissions per IP per 10 minutes (default 5)
 */
const express = require('express');
const cors = require('cors');
const requestIdMiddleware = require('../middleware/requestId.middleware');
const { createIpRateLimiter } = require('../middleware/publicRateLimit.middleware');
const { makeControllers } = require('../controllers/contactEnquiryController');

const DEFAULT_ORIGINS = [
  'https://jurinex.ai',
  'https://www.jurinex.ai',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];

function allowedOrigins() {
  const raw = String(process.env.CONTACT_FORM_ALLOWED_ORIGINS || '').trim();
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
  r.use(express.json({ limit: '64kb' }));
  r.use(express.urlencoded({ extended: false, limit: '64kb' })); // plain HTML <form> posts too
  r.use(requestIdMiddleware);

  const limiter = createIpRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: Number.parseInt(process.env.CONTACT_FORM_RATE_LIMIT || '5', 10) || 5,
    name: 'public-contact-form',
  });

  r.get('/health', (_req, res) => res.json({ success: true, service: 'contact-form', timezone: 'Asia/Kolkata' }));
  r.post('/', limiter, ctrl.submitEnquiry);

  // Anything else under /api/public/contact ends here (never falls through to admin routes).
  r.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API Endpoint Not Found' } }));

  return r;
};

module.exports = router;
