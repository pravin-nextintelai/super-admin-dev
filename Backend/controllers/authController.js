

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const logger = require('../config/logger');
const { summarizeValue } = require('../utils/logging.utils');

const ROLE_HOME = {
  'marketing-admin': '/dashboard/demo-bookings',
  'finance-admin': '/dashboard/subscriptions/analytics',
  'account-admin': '/dashboard/subscriptions',
  'user-admin': '/dashboard/users',
  'support-admin': '/dashboard/support',
  'super-admin': '/dashboard',
};

module.exports = (pool) => {
  /**
   * @desc Login admin
   * @route POST /api/auth/login
   * @access Public
   */
  const loginAdmin = async (req, res) => {
    const startedAt = Date.now();
    const { email, password } = req.body;

    logger.flow('Admin login attempt', {
      requestId: req.requestId,
      layer: 'AUTH_LOGIN',
      summary: {
        action: 'login',
        email: email || null,
        hasPassword: Boolean(password),
      },
      input: summarizeValue({ email, password: password ? '[hidden]' : null }),
    });

    if (!email || !password) {
      logger.flow('Admin login rejected: missing credentials', {
        requestId: req.requestId,
        layer: 'AUTH_LOGIN',
        level: 'warn',
        summary: { email: email || null },
      });
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
      const result = await pool.query(
        `SELECT a.id, a.name, a.email, a.password, r.name AS role_name
         FROM super_admins a
         JOIN admin_roles r ON a.role_id = r.id
         WHERE a.email = $1`,
        [email]
      );

      const admin = result.rows[0];
      logger.flow('Admin login lookup complete', {
        requestId: req.requestId,
        layer: 'AUTH_LOGIN',
        summary: {
          email,
          found: Boolean(admin),
          adminId: admin?.id || null,
          role: admin?.role_name || null,
          rowCount: result.rowCount,
        },
        table: admin
          ? [{ id: admin.id, name: admin.name, email: admin.email, role: admin.role_name }]
          : [],
      });

      if (!admin) {
        logger.flow('Admin login failed: not found', {
          requestId: req.requestId,
          layer: 'AUTH_LOGIN',
          level: 'warn',
          summary: { email, statusCode: 404 },
          metrics: { durationMs: Date.now() - startedAt },
        });
        return res.status(404).json({ message: 'Admin not found' });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        logger.flow('Admin login failed: invalid credentials', {
          requestId: req.requestId,
          layer: 'AUTH_LOGIN',
          level: 'warn',
          summary: {
            email,
            adminId: admin.id,
            role: admin.role_name,
            statusCode: 401,
          },
          metrics: { durationMs: Date.now() - startedAt },
        });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: admin.id, role: admin.role_name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const landingPath = ROLE_HOME[admin.role_name] || '/dashboard';
      logger.flow('Admin login success', {
        requestId: req.requestId,
        layer: 'AUTH_LOGIN',
        summary: {
          action: 'login',
          adminId: admin.id,
          email: admin.email,
          role: admin.role_name,
          landingPath,
          tokenIssued: true,
        },
        output: summarizeValue({
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role_name,
          landingPath,
        }),
        metrics: { durationMs: Date.now() - startedAt },
      });

      res.status(200).json({
        success: true,
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role_name
        }
      });
    } catch (error) {
      logger.errorWithContext('Admin login error', error, {
        requestId: req.requestId,
        layer: 'AUTH_LOGIN',
        summary: { email },
        metrics: { durationMs: Date.now() - startedAt },
      });
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };

  return { loginAdmin };
};
