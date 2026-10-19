/**
 * Sales Referrals — super-admin router.
 * Mounted at /api/admin/sales-referrals and /api/v1/admin/sales-referrals (see server.js).
 *
 * Data: Auth / Main DB → sales_owners, referral_codes, tenant_referrals (workspaces = firms).
 * Auth: adminAuth.middleware (static ADMIN_TOKEN or dashboard JWT) + super-admin / finance-admin role gate.
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers } = require('../controllers/salesReferralsController');

// 'admin' is the legacy generic super role used by older dashboard accounts.
const ALLOWED_ROLES = ['super-admin', 'admin', 'finance-admin'];

function requireSuperAdmin(req, res, next) {
  // No req.user → request passed adminAuth with the static ADMIN_TOKEN (Postman / test runner).
  if (!req.user) return next();
  if (ALLOWED_ROLES.includes(req.user.role)) return next();
  logger.flow('Sales referrals: role not allowed', {
    requestId: req.requestId,
    layer: 'AUTH',
    level: 'warn',
    summary: { userId: req.user.id, role: req.user.role, path: req.originalUrl, allowed: ALLOWED_ROLES.join(', ') },
  });
  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: "You don't have access to this page." },
    requestId: req.requestId,
  });
}

/** @param {import('pg').Pool} pool Auth / Main DB */
const router = (pool) => {
  const r = express.Router();
  r.use(adminAuth(pool), requireSuperAdmin);
  const ctrl = makeControllers(pool);

  // Owners (A1–A4)
  r.post('/owners', ctrl.createOwner);
  r.get('/owners/:ownerId', ctrl.getOwner);
  r.put('/owners/:ownerId', ctrl.updateOwner);
  r.post('/owners/:ownerId/codes', ctrl.addCode);
  r.post('/owners/:ownerId/email', ctrl.emailOwnerCodes); // A19 one email with all active codes + links

  // Codes (A9–A11 static paths before /:codeId)
  r.get('/codes/suggest', ctrl.suggestCodes);
  r.get('/codes/availability', ctrl.checkAvailability);
  r.get('/codes', ctrl.searchCodes);
  r.patch('/codes/:codeId', ctrl.updateCodeLabel);
  r.post('/codes/:codeId/deactivate', ctrl.deactivateCode);
  r.post('/codes/:codeId/activate', ctrl.activateCode);
  r.post('/codes/:codeId/refresh', ctrl.refreshCode);
  r.post('/codes/:codeId/email', ctrl.emailCode);       // A18 send code + link to the sales owner

  // Reports (A12–A15)
  r.get('/reports/summary', ctrl.reportSummary);
  r.get('/reports/owners', ctrl.reportOwners);
  r.get('/reports/owners/:ownerId/codes', ctrl.reportOwnerCodes);
  r.get('/reports/signups', ctrl.reportSignups);

  // Workspace referral (A16–A17)
  r.put('/tenants/:tenantId/referral', ctrl.setTenantReferral);
  r.get('/tenants/:tenantId/referral', ctrl.getTenantReferral);
  r.get('/users/:userId/referral', ctrl.getUserReferral);

  return r;
};

module.exports = router;
