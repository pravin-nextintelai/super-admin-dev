/**
 * API audit log ("Activity & Error Logs") — admin read-only.
 * Mounted at /api/admin/audit-logs (see server.js).
 *
 * Data: Document_DB → api_audit_logs (docPool), one row per API call across every service.
 * Owned by agentic-document-service; this router never creates or alters the table.
 *
 * Auth: adminAuth.middleware (static ADMIN_TOKEN or dashboard JWT) + role gate.
 *   read : super-admin, admin
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers } = require('../controllers/auditLogController');

const READ_ROLES = ['super-admin', 'admin'];

function requireRoles(allowed) {
  return (req, res, next) => {
    // No req.user → request passed adminAuth with the static ADMIN_TOKEN (Postman / test runner).
    if (!req.user) return next();
    if (allowed.includes(req.user.role)) return next();

    logger.flow('Audit logs: role not allowed', {
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
 * @param {import('pg').Pool} pool     Auth / Main DB — admin JWT lookup + user enrichment
 * @param {import('pg').Pool} docPool  Document_DB — api_audit_logs (+ error_logs for the linked error)
 */
const router = (pool, docPool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  const canRead = requireRoles(READ_ROLES);
  const ctrl = makeControllers(pool, docPool);

  r.get('/summary', auth, canRead, ctrl.getSummary);
  r.get('/meta', auth, canRead, ctrl.getMeta);
  r.get('/export', auth, canRead, ctrl.exportCsv);
  r.get('/', auth, canRead, ctrl.listAudit);
  r.get('/:id', auth, canRead, ctrl.getAudit);

  return r;
};

module.exports = router;
