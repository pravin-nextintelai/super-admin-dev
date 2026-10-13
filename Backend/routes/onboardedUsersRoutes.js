/**
 * Onboarded users + complete subscription history — admin read-only.
 * Mounted at /api/admin/onboarded-users (see server.js).
 *
 * Auth DB (users, firms, referrals → onboarding channel) + Payment DB (subscriptions, payments,
 * top-ups, storage add-ons). Read-only: nothing here writes to either database.
 *
 * Auth: adminAuth.middleware (static ADMIN_TOKEN or dashboard JWT) + role gate.
 *   read: super-admin, admin, account-admin, finance-admin
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers } = require('../controllers/onboardedUsersController');

const READ_ROLES = ['super-admin', 'admin', 'account-admin', 'finance-admin'];

function requireRoles(allowed) {
  return (req, res, next) => {
    if (!req.user) return next(); // static ADMIN_TOKEN
    if (allowed.includes(req.user.role)) return next();
    logger.flow('Onboarded users: role not allowed', {
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

/**
 * @param {import('pg').Pool} pool     Auth / Main DB
 * @param {import('pg').Pool} payPool  Payment DB
 */
const router = (pool, payPool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  const canRead = requireRoles(READ_ROLES);
  const ctrl = makeControllers(pool, payPool);

  r.get('/summary', auth, canRead, ctrl.getSummary);
  r.get('/meta', auth, canRead, ctrl.getMeta);
  r.get('/export', auth, canRead, ctrl.exportCsv);
  r.get('/', auth, canRead, ctrl.listUsers);
  r.get('/:userId', auth, canRead, ctrl.getUser);

  return r;
};

module.exports = router;
