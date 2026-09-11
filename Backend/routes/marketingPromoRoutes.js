/**
 * Marketing admin — Offers & events (website header bar).
 * Mounted at /api/admin/promos
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers } = require('../controllers/marketingPromoController');

const MARKETING_ROLES = ['super-admin', 'admin', 'marketing-admin'];

function requireRoles(allowed) {
  return (req, res, next) => {
    if (!req.user) return next();
    if (allowed.includes(req.user.role)) return next();
    logger.flow('Marketing promos: role not allowed', {
      requestId: req.requestId,
      layer: 'AUTH',
      level: 'warn',
      summary: { userId: req.user.id, role: req.user.role, path: req.originalUrl },
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
  r.get('/', auth, marketing, ctrl.listAdmin);
  r.post('/', auth, marketing, ctrl.createAdmin);
  r.get('/:id', auth, marketing, ctrl.getAdmin);
  r.put('/:id', auth, marketing, ctrl.updateAdmin);
  r.patch('/:id/status', auth, marketing, ctrl.patchStatus);
  r.delete('/:id', auth, marketing, ctrl.removeAdmin);

  return r;
};

module.exports = router;
