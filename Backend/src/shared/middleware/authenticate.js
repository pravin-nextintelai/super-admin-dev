const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/env');
const logger = require('../../config/logger');

const { authorize, normalizeRoleName } = require('./authorize');

/**
 * Protect routes: Verify JWT and attach user object from DB
 */
const protect = (pool) => async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Authorization header missing or malformed', {
      layer: 'AUTH',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  let rawToken = authHeader.split(' ')[1];
  if (!rawToken) {
    logger.warn('Bearer token missing after Authorization header parsing', {
      layer: 'AUTH',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  let token = rawToken.trim();
  // If frontend sent "Bearer <jwt>" in the token value, strip prefix so verify gets raw JWT
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  if (!JWT_SECRET) {
    logger.error('JWT verification failed because JWT_SECRET is not configured', {
      layer: 'AUTH',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const tokenRole = decoded.role;

    // Ensure id is passed as integer if DB uses integer type
    const userId = decoded.id != null ? Number(decoded.id) : decoded.id;

    // Fetch user from DB to ensure user exists and is active
    const userResult = await pool.query(
      `SELECT a.id, a.email, a.is_blocked, r.name AS role
       FROM super_admins a
       JOIN admin_roles r ON a.role_id = r.id
       WHERE a.id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      logger.warn('Authenticated token resolved to a missing admin user', {
        layer: 'AUTH',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        userId,
      });
      return res.status(401).json({ message: 'Unauthorized: User not found or blocked' });
    }
    if (user.is_blocked) {
      logger.warn('Blocked admin attempted to access a protected route', {
        layer: 'AUTH',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        userId: user.id,
        role: user.role,
      });
      return res.status(401).json({ message: 'Unauthorized: User is blocked' });
    }

    req.user = {
      ...user,
      tokenRole,
      normalizedRole: normalizeRoleName(user.role || tokenRole),
      normalizedTokenRole: normalizeRoleName(tokenRole),
    }; // Attach user object to request
    logger.debug('Authenticated admin request', {
      layer: 'AUTH',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      userId: user.id,
      role: user.role,
      normalizedRole: normalizeRoleName(user.role || tokenRole),
      tokenRole,
    });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('JWT token expired', {
        layer: 'AUTH',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
      });
      return res.status(401).json({ message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.error('JWT verification error', {
        layer: 'AUTH',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        error: err.message,
        tokenLength: token?.length,
        tokenPreview: token?.slice(0, 12),
      });
      return res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    logger.error('Unexpected auth middleware error', {
      layer: 'AUTH',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ message: 'Authentication error' });
  }
};

// `authorize` lives in ./authorize.js; re-exported here so `require('./authenticate')` keeps working.
module.exports = { protect, authorize };
