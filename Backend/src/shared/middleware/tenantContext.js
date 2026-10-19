/**
 * Tenant context (blueprint: shared/middleware/tenantContext.js).
 * Attaches `req.tenant` so downstream handlers/logs can scope work to a workspace without re-deriving it:
 *   - `X-Tenant-Id` header when the portal is acting on behalf of a workspace (firms.id uuid)
 *   - otherwise the authenticated admin's own firm, when `authenticate.protect` has already populated req.user
 * Never rejects a request on its own; authorization stays in `authorize.js` / the module routers.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tenantContext(req, res, next) {
  const header = String(req.headers['x-tenant-id'] || '').trim();
  req.tenant = {
    id: UUID_RE.test(header) ? header.toLowerCase() : (req.user && req.user.firm_id) || null,
    source: UUID_RE.test(header) ? 'header' : (req.user && req.user.firm_id ? 'user' : null),
  };
  next();
}

module.exports = tenantContext;
