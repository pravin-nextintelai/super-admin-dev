/**
 * Platform error logs — admin read / resolve / delete.
 * Mounted at /api/admin/error-logs (see server.js).
 *
 * Data: Document_DB → error_logs (docPool). Owned by agentic-document-service; every service
 * writes into it. This router never creates or alters the table.
 *
 * Auth: adminAuth.middleware (static ADMIN_TOKEN or dashboard JWT) + role gate.
 *   read / resolve : super-admin, admin
 *   delete         : super-admin, admin
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers, DELETE_ROLES } = require('../controllers/errorLogController');

const READ_ROLES = ['super-admin', 'admin'];
const RESOLVE_ROLES = ['super-admin', 'admin'];

function requireRoles(allowed) {
  return (req, res, next) => {
    // No req.user → request passed adminAuth with the static ADMIN_TOKEN (Postman / test runner).
    if (!req.user) return next();
    if (allowed.includes(req.user.role)) return next();

    logger.flow('Error logs: role not allowed', {
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
 * @param {import('pg').Pool} docPool  Document_DB — error_logs table
 */
const router = (pool, docPool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  const canRead = requireRoles(READ_ROLES);
  const canResolve = requireRoles(RESOLVE_ROLES);
  const canDelete = requireRoles(DELETE_ROLES);
  const ctrl = makeControllers(pool, docPool);

  // Dashboard widgets + filter metadata
  r.get('/stats', auth, canRead, ctrl.getStats);
  r.get('/meta', auth, canRead, ctrl.getMeta);

  // Groupings
  r.get('/users', auth, canRead, ctrl.listUsers);
  r.get('/issues', auth, canRead, ctrl.listIssues);

  // List + CSV export (same filters)
  r.get('/', auth, canRead, ctrl.listLogs);
  r.get('/export', auth, canRead, ctrl.exportCsv);

  // Bulk operations (static paths must be registered before /:id)
  r.patch('/resolve', auth, canResolve, ctrl.resolveBulk);
  r.post('/bulk-delete', auth, canDelete, ctrl.deleteBulk);

  // Single row
  r.get('/:id', auth, canRead, ctrl.getLog);
  r.patch('/:id/resolve', auth, canResolve, ctrl.resolveOne);
  r.delete('/:id', auth, canDelete, ctrl.deleteOne);

  return r;
};

module.exports = router;
