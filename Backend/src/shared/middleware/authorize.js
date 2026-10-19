/**
 * Role-based authorization middleware (blueprint: shared/middleware/authorize.js).
 * `authorize([...roles])` runs after `authenticate.protect` and checks req.user.role (normalised).
 * `adminProtect` is the legacy single-role check kept for completeness.
 */
const logger = require('../../config/logger');

const normalizeRoleName = (role) =>
  String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

/**
 * Role-based authorization: Only allow access if user has one of the allowed roles
 * @param {Array} roles - List of allowed roles, e.g., ['super-admin', 'user-admin']
 */
const authorize = (roles = []) => (req, res, next) => {
  const normalizedAllowedRoles = roles.map(normalizeRoleName);

  if (!req.user) {
    logger.warn('Authorization failed because req.user is missing', {
      layer: 'AUTH',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      allowedRoles: roles,
      normalizedAllowedRoles,
    });
    return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
  }

  const currentRole = req.user.role || req.user.tokenRole || '';
  const normalizedCurrentRole =
    req.user.normalizedRole ||
    req.user.normalizedTokenRole ||
    normalizeRoleName(currentRole);

  if (!normalizedAllowedRoles.includes(normalizedCurrentRole)) {
    logger.flow('Authorization denied for admin request', {
      layer: 'AUTH',
      level: 'warn',
      requestId: req.requestId,
      summary: {
        userId: req.user.id,
        currentRole,
        normalizedCurrentRole,
        method: req.method,
        path: req.originalUrl,
        allowedRoles: roles.join(', '),
      },
    });
    return res.status(403).json({
      message: `Access denied: Requires one of the following roles: ${roles.join(', ')}`,
      currentRole,
      normalizedCurrentRole,
      allowedRoles: roles,
    });
  }

  const isPortalRole = normalizedCurrentRole === 'finance-admin' || normalizedCurrentRole === 'marketing-admin';
  logger.flow('Authorization granted for admin request', {
    layer: 'AUTH',
    level: isPortalRole ? 'info' : 'debug',
    requestId: req.requestId,
    summary: {
      userId: req.user.id,
      role: normalizedCurrentRole,
      method: req.method,
      path: req.originalUrl,
    },
  });
  next();
};


const adminProtect = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Requires admin role' });
  }

  next();
};

module.exports = { adminProtect };

module.exports = { authorize, normalizeRoleName, adminProtect };
