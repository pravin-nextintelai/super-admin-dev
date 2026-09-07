const logger = require('../config/logger');
const { summarizeValue } = require('./logging.utils');

function portalRoleMeta(req = {}) {
  return {
    userId: req.user?.id ?? null,
    role: req.user?.role || req.user?.normalizedRole || null,
    email: req.user?.email || null,
    method: req.method || null,
    path: req.originalUrl || req.path || null,
  };
}

function logPortalFlow(req, message, extra = {}) {
  const base = portalRoleMeta(req);
  logger.flow(message, {
    requestId: req?.requestId,
    layer: extra.layer || 'PORTAL_ADMIN',
    level: extra.level || 'info',
    summary: {
      ...base,
      ...(extra.summary || {}),
    },
    ...(extra.input != null ? { input: summarizeValue(extra.input) } : {}),
    ...(extra.output != null ? { output: summarizeValue(extra.output) } : {}),
    ...(extra.context != null ? { context: extra.context } : {}),
    ...(extra.metrics != null ? { metrics: extra.metrics } : {}),
    ...(Array.isArray(extra.table) ? { table: extra.table } : {}),
  });
}

module.exports = { logPortalFlow, portalRoleMeta };
