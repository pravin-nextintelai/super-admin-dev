/**
 * Marketing admin — Contact enquiries.
 * Mounted at /api/admin/contact-enquiries (see server.js).
 *
 * Auth: adminAuth.middleware (static ADMIN_TOKEN or dashboard JWT) + role gate.
 *   read / update / contact-log / notes : super-admin, admin, marketing-admin
 *   delete                              : super-admin, admin (marketing should mark as spam/closed instead)
 */
const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const logger = require('../config/logger');
const { makeControllers } = require('../controllers/contactEnquiryController');

const MARKETING_ROLES = ['super-admin', 'admin', 'marketing-admin'];
const DELETE_ROLES = ['super-admin', 'admin'];

function requireRoles(allowed) {
  return (req, res, next) => {
    // No req.user → request passed adminAuth with the static ADMIN_TOKEN (Postman / test runner).
    if (!req.user) return next();
    if (allowed.includes(req.user.role)) return next();

    logger.flow('Contact enquiries: role not allowed', {
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
  const canDelete = requireRoles(DELETE_ROLES);
  const ctrl = makeControllers(pool);

  // Dashboard widgets
  r.get('/stats', auth, marketing, ctrl.getStats);
  r.get('/meta', auth, marketing, ctrl.getMeta);

  // List + CSV export (same filters)
  r.get('/', auth, marketing, ctrl.listEnquiries);
  r.get('/export', auth, marketing, ctrl.exportCsv);

  // Single enquiry
  r.get('/:id', auth, marketing, ctrl.getEnquiry);
  r.patch('/:id', auth, marketing, ctrl.updateEnquiry);
  r.post('/:id/contact-log', auth, marketing, ctrl.logContact);
  r.post('/:id/notes', auth, marketing, ctrl.addNote);
  r.delete('/:id', auth, canDelete, ctrl.deleteEnquiry);

  return r;
};

module.exports = router;
