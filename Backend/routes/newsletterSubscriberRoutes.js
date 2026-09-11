/**
 * Marketing admin — Newsletter subscribers.
 * Mounted at /api/admin/newsletter-subscribers (see server.js).
 *
 * Auth: adminAuth.middleware + role gate.
 *   read / export : super-admin, admin, marketing-admin
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers } = require('../controllers/newsletterSubscriberController');

const MARKETING_ROLES = ['super-admin', 'admin', 'marketing-admin'];

function requireRoles(allowed) {
  return (req, res, next) => {
    if (!req.user) return next();
    if (allowed.includes(req.user.role)) return next();

    logger.flow('Newsletter subscribers: role not allowed', {
      requestId: req.requestId,
      layer: 'AUTH',
      level: 'warn',
      summary: { userId: req.user.id, role: req.user.role, path: req.originalUrl, allowed: allowed.join(', ') },
    });
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: `Access denied: requires one of ${allowed.join(', ')}` },
      requestId: req.requestId,
    });
  };
}

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  const marketing = requireRoles(MARKETING_ROLES);
  const ctrl = makeControllers(pool);

  r.get('/stats', auth, marketing, ctrl.getStats);
  r.get('/', auth, marketing, ctrl.listSubscribers);
  r.get('/export', auth, marketing, ctrl.exportCsv);
  r.get('/:id', auth, marketing, ctrl.getSubscriber);

  return r;
};

module.exports = router;
