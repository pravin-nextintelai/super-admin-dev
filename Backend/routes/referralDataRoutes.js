/**
 * Sales Referrals → "All referral data" screen (workspaces, plan purchases, CSV).
 * Mounted at /api/admin/sales-referrals/data (before the main sales-referrals router).
 * Read-only. Roles: super-admin, admin.
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers } = require('../controllers/referralDataController');

const READ_ROLES = ['super-admin', 'admin'];

function requireRoles(allowed) {
  return (req, res, next) => {
    if (!req.user) return next();
    if (allowed.includes(req.user.role)) return next();
    logger.flow('Referral data: role not allowed', { requestId: req.requestId, layer: 'AUTH', level: 'warn', summary: { userId: req.user.id, role: req.user.role, path: req.originalUrl } });
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Access denied: requires one of ${allowed.join(', ')}` }, requestId: req.requestId });
  };
}

const router = (pool, payPool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  const canRead = requireRoles(READ_ROLES);
  const ctrl = makeControllers(pool, payPool);

  r.get('/summary', auth, canRead, ctrl.getSummary);
  r.get('/columns', auth, canRead, ctrl.getColumns);
  r.get('/export', auth, canRead, ctrl.exportCsv);
  r.get('/purchases', auth, canRead, ctrl.listPurchases);
  r.get('/workspaces', auth, canRead, ctrl.listWorkspaces);
  r.get('/workspaces/:id', auth, canRead, ctrl.getWorkspace);
  r.get('/', auth, canRead, ctrl.listWorkspaces);

  return r;
};

module.exports = router;
