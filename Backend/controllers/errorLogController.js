/**
 * Error logs (platform-wide) — controllers.
 *
 *   GET    /api/admin/error-logs/stats          KPIs, trend, breakdowns, top issues / endpoints / users
 *   GET    /api/admin/error-logs/meta           distinct filter values + vocab + permissions
 *   GET    /api/admin/error-logs                paginated list (filters below)
 *   GET    /api/admin/error-logs/export         CSV, same filters as the list
 *   GET    /api/admin/error-logs/users          errors grouped per user
 *   GET    /api/admin/error-logs/issues         errors grouped per fingerprint
 *   GET    /api/admin/error-logs/:id            full row + stack trace + payload + related rows
 *   PATCH  /api/admin/error-logs/:id/resolve    { resolved, note? }
 *   PATCH  /api/admin/error-logs/resolve        { ids[] | fingerprint, resolved, note? }
 *   DELETE /api/admin/error-logs/:id
 *   POST   /api/admin/error-logs/bulk-delete    { ids[] | fingerprint }
 *
 * Data lives in Document_DB (docPool, table error_logs). Auth and user enrichment use the
 * Auth/Main DB (pool). All timestamps are returned as UTC ISO plus an `*_ist` object.
 */
const Joi = require('joi');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');
const { CSV_BOM, csvHeader, csvRow } = require('../utils/csv');
const { formatIST, IST_TIMEZONE } = require('../utils/time');
const svc = require('../services/errorLogService');

const LAYER = 'ERROR_LOGS';
const MAX_EXPORT_ROWS = 5000;
const MAX_BULK_IDS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DELETE_ROLES = ['super-admin', 'admin'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fail(req, res, statusCode, code, message, details) {
  const body = { success: false, error: { code, message }, requestId: req.requestId };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}

function validate(schema, data) {
  const { error, value } = schema.validate(data || {}, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) return { error: error.details.map((d) => d.message) };
  return { value };
}

function actorLabel(req) {
  if (req.user) return req.user.email || (req.user.id != null ? `admin#${req.user.id}` : null);
  return 'admin-token';
}

function idParam(req) {
  const id = String(req.params.id || '').trim();
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

/** "a,b, c" → ['a','b','c'] (optionally upper-cased). Empty → []. */
function csv(raw, { upper = false } = {}) {
  if (raw === undefined || raw === null || raw === '') return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(parts.map((s) => String(s).trim()).filter(Boolean).map((s) => (upper ? s.toUpperCase() : s)))];
}

function serverError(req, res, message, err) {
  // 42P01 = undefined_table: the owning service has not created error_logs yet.
  if (err && err.code === '42P01') {
    logger.errorWithContext('Error logs: table error_logs does not exist in Document_DB', err, { requestId: req.requestId, layer: LAYER });
    return fail(
      req,
      res,
      503,
      'ERROR_LOGS_TABLE_MISSING',
      'The error_logs table does not exist in Document_DB yet. It is created by agentic-document-service (migration 183_error_logs.sql) on its first start.'
    );
  }
  logger.errorWithContext(message, err, { requestId: req.requestId, layer: LAYER });
  return fail(req, res, 500, 'INTERNAL_ERROR', message);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const boolish = () => Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false');
const dateStr = (label) =>
  Joi.string().trim().pattern(DATE_RE).messages({ 'string.pattern.base': `"${label}" must be YYYY-MM-DD (IST calendar date)` });

const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200),
  pageSize: Joi.number().integer().min(1).max(200),
  service: Joi.string().trim().max(500).allow(''),
  environment: Joi.string().trim().max(200).allow(''),
  source: Joi.string().trim().max(200).allow(''),
  category: Joi.string().trim().max(500).allow(''),
  severity: Joi.string().trim().max(100).allow(''),
  status_code: Joi.string().trim().max(200).allow(''),
  status_class: Joi.string().trim().lowercase().valid(...svc.STATUS_CLASSES).allow(''),
  error_type: Joi.string().trim().max(255).allow(''),
  provider: Joi.string().trim().max(50).allow(''),
  user: Joi.string().trim().max(255).allow(''),
  user_id: Joi.string().trim().max(64).allow(''),
  user_email: Joi.string().trim().max(255).allow(''),
  request_id: Joi.string().trim().max(64).allow(''),
  fingerprint: Joi.string().trim().max(64).allow(''),
  endpoint: Joi.string().trim().max(500).allow(''),
  route: Joi.string().trim().max(500).allow(''),
  method: Joi.string().trim().max(255).allow(''),
  resolved: Joi.string().trim().lowercase().valid('all', 'true', 'false', '1', '0', 'yes', 'no').default('all'),
  has_user: boolish(),
  origin: Joi.string().trim().lowercase().valid('browser', 'server', 'all').allow(''),
  exclude_debug: boolish(),
  search: Joi.string().trim().max(200).allow(''),
  from: dateStr('from'),
  to: dateStr('to'),
  since_hours: Joi.number().integer().min(1).max(24 * 366),
  sort: Joi.string().trim().lowercase().valid(...svc.SORT_OPTIONS).default('newest'),
});

const usersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200),
  pageSize: Joi.number().integer().min(1).max(200),
  service: Joi.string().trim().max(500).allow(''),
  severity: Joi.string().trim().max(100).allow(''),
  category: Joi.string().trim().max(500).allow(''),
  resolved: Joi.string().trim().lowercase().valid('all', 'true', 'false', '1', '0', 'yes', 'no').default('all'),
  origin: Joi.string().trim().lowercase().valid('browser', 'server', 'all').allow(''),
  exclude_debug: boolish(),
  search: Joi.string().trim().max(200).allow(''),
  from: dateStr('from'),
  to: dateStr('to'),
  since_hours: Joi.number().integer().min(1).max(24 * 366),
  sort: Joi.string().trim().lowercase().valid(...svc.USER_SORT_OPTIONS).default('most_errors'),
});

const issuesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  service: Joi.string().trim().max(500).allow(''),
  severity: Joi.string().trim().max(100).allow(''),
  category: Joi.string().trim().max(500).allow(''),
  resolved: Joi.string().trim().lowercase().valid('all', 'true', 'false', '1', '0', 'yes', 'no').default('all'),
  user: Joi.string().trim().max(255).allow(''),
  origin: Joi.string().trim().lowercase().valid('browser', 'server', 'all').allow(''),
  exclude_debug: boolish(),
  search: Joi.string().trim().max(200).allow(''),
  from: dateStr('from'),
  to: dateStr('to'),
  since_hours: Joi.number().integer().min(1).max(24 * 366),
});

const resolveOneSchema = Joi.object({
  resolved: Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false').default(true),
  note: Joi.string().trim().max(5000).allow('', null),
});

const idList = Joi.array().items(Joi.string().trim().pattern(UUID_RE).messages({ 'string.pattern.base': 'each id must be a UUID' })).min(1).max(MAX_BULK_IDS);

const resolveBulkSchema = Joi.object({
  ids: idList,
  fingerprint: Joi.string().trim().min(8).max(64),
  resolved: Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false').default(true),
  note: Joi.string().trim().max(5000).allow('', null),
}).xor('ids', 'fingerprint');

const bulkDeleteSchema = Joi.object({
  ids: idList,
  fingerprint: Joi.string().trim().min(8).max(64),
}).xor('ids', 'fingerprint');

function parseResolved(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return undefined;
  return ['true', '1', 'yes'].includes(String(raw).toLowerCase());
}

function parseStatusCodes(raw) {
  const parts = csv(raw);
  const codes = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 100 || n > 599) return { error: `Unknown status_code "${part}" (expected 100–599)` };
    codes.push(n);
  }
  return { codes };
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * @param {import('pg').Pool} pool     Auth / Main DB (admin JWT lookup, users enrichment)
 * @param {import('pg').Pool} docPool  Document_DB (error_logs)
 */
function makeControllers(pool, docPool) {
  /** Shared list-filter resolution (list + export + issues/users subsets). */
  function resolveFilters(q) {
    const st = parseStatusCodes(q.status_code);
    if (st.error) return { error: [st.error] };
    if (q.from && q.to && q.from > q.to) return { error: ['"from" must be on or before "to"'] };

    const filters = {
      services: csv(q.service),
      environments: csv(q.environment),
      sources: csv(q.source, { upper: true }),
      categories: csv(q.category, { upper: true }),
      severities: csv(q.severity, { upper: true }),
      status_codes: st.codes,
      status_class: q.status_class || undefined,
      error_type: q.error_type || undefined,
      provider: q.provider || undefined,
      user: q.user || undefined,
      user_id: q.user_id || undefined,
      user_email: q.user_email || undefined,
      request_id: q.request_id || undefined,
      fingerprint: q.fingerprint || undefined,
      endpoint: q.endpoint || undefined,
      route: q.route || undefined,
      method: q.method || undefined,
      resolved: parseResolved(q.resolved),
      has_user: typeof q.has_user === 'boolean' ? q.has_user : undefined,
      origin: q.origin && q.origin !== 'all' ? q.origin : undefined,
      exclude_debug: q.exclude_debug === true,
      search: q.search || undefined,
      from: q.from,
      to: q.to,
      since: q.since_hours ? new Date(Date.now() - q.since_hours * 3600 * 1000) : undefined,
    };

    const applied = {
      service: filters.services.length ? filters.services : 'all',
      environment: filters.environments.length ? filters.environments : 'all',
      source: filters.sources.length ? filters.sources : 'all',
      category: filters.categories.length ? filters.categories : 'all',
      severity: filters.severities.length ? filters.severities : 'all',
      status_code: filters.status_codes.length ? filters.status_codes : 'all',
      status_class: filters.status_class || null,
      error_type: filters.error_type || null,
      provider: filters.provider || null,
      user: filters.user || null,
      user_id: filters.user_id || null,
      user_email: filters.user_email || null,
      request_id: filters.request_id || null,
      fingerprint: filters.fingerprint || null,
      endpoint: filters.endpoint || null,
      route: filters.route || null,
      method: filters.method || null,
      resolved: typeof filters.resolved === 'boolean' ? filters.resolved : 'all',
      has_user: typeof filters.has_user === 'boolean' ? filters.has_user : null,
      origin: filters.origin || 'all',
      exclude_debug: filters.exclude_debug,
      search: filters.search || null,
      from: filters.from || null,
      to: filters.to || null,
      since_hours: q.since_hours || null,
      timezone: IST_TIMEZONE,
    };
    return { filters, applied };
  }

  function resolveListQuery(req, { forExport = false } = {}) {
    const { error, value: q } = validate(listSchema, req.query);
    if (error) return { error };
    const f = resolveFilters(q);
    if (f.error) return f;
    return {
      filters: f.filters,
      sort: q.sort,
      page: forExport ? 1 : q.page,
      limit: forExport ? MAX_EXPORT_ROWS : q.limit || q.pageSize || 20,
      applied: { ...f.applied, sort: q.sort },
    };
  }

  /**
   * Resolve the `user` filter through the Auth DB so an email also matches rows that only
   * recorded the user id (and vice versa). Echoes who was matched as `filters.user_resolved`.
   */
  async function attachUserMatch(filters, applied) {
    if (!filters.user) return;
    const m = await svc.resolveUserFilter(pool, filters.user, logger);
    filters.user_match = m;
    applied.user_resolved = m.resolved
      ? { id: m.resolved.id, email: m.resolved.email, username: m.resolved.username }
      : null;
  }

  async function serializeWithUsers(rows, now) {
    const maps = await svc.enrichRows(pool, rows, logger);
    return rows.map((r) => svc.serializeLog(r, { now, user: svc.resolveUserFor(r, maps) }));
  }

  // GET /stats
  const getStats = async (req, res) => {
    try {
      const now = new Date();
      const s = await svc.getStats(docPool);
      const t = s.totals;

      const userMaps = await svc.enrichRows(pool, [...s.top_users, ...s.recent_unresolved], logger);

      const data = {
        timezone: IST_TIMEZONE,
        generated_at: now.toISOString(),
        generated_at_ist: formatIST(now),
        totals: {
          total: t.total,
          unresolved: t.unresolved,
          resolved: t.resolved,
          critical: t.critical,
          error: t.error,
          warning: t.warning,
          critical_unresolved: t.critical_unresolved,
          last_hour: t.last_hour,
          last_24h: t.last_24h,
          today: t.today,
          yesterday: t.yesterday,
          last_7_days: t.last_7_days,
          last_30_days: t.last_30_days,
          this_month: t.this_month,
          with_user: t.with_user,
          affected_users: t.affected_users,
          affected_users_24h: t.affected_users_24h,
          affected_users_unresolved: t.affected_users_unresolved,
          distinct_issues: t.distinct_issues,
          distinct_issues_unresolved: t.distinct_issues_unresolved,
          services: t.services,
          external_api: t.external_api,
          http_5xx: t.http_5xx,
          http_4xx: t.http_4xx,
          browser: t.browser,
          recovered: t.recovered,
          debug: t.debug,
          avg_latency_ms: t.avg_latency_ms ?? null,
          resolved_rate_pct: t.total ? Math.round((t.resolved / t.total) * 1000) / 10 : 0,
          last_error_at: t.last_error_at ? new Date(t.last_error_at).toISOString() : null,
          last_error_at_ist: formatIST(t.last_error_at),
          last_critical_at: t.last_critical_at ? new Date(t.last_critical_at).toISOString() : null,
          last_critical_at_ist: formatIST(t.last_critical_at),
        },
        daily_trend: s.daily_trend,
        by_service: s.by_service.map((r) => ({ ...r, last_error_at: r.last_error_at ? new Date(r.last_error_at).toISOString() : null, last_error_at_ist: formatIST(r.last_error_at) })),
        by_category: s.by_category.map((r) => ({ ...r, label: svc.CATEGORY_LABELS[r.value] || r.value })),
        by_source: s.by_source.map((r) => ({ ...r, label: svc.SOURCE_LABELS[r.value] || r.value })),
        by_severity: s.by_severity.map((r) => ({ ...r, label: svc.SEVERITY_LABELS[r.value] || r.value })),
        by_status_code: s.by_status_code,
        by_environment: s.by_environment,
        top_endpoints: s.top_endpoints.map((r) => ({ ...r, last_error_at: r.last_error_at ? new Date(r.last_error_at).toISOString() : null, last_error_at_ist: formatIST(r.last_error_at) })),
        top_issues: s.top_issues.map((r) => svc.serializeIssue(r, { now })),
        top_users: s.top_users.map((r) => svc.serializeUserGroup(r, { now, user: svc.resolveUserFor(r, userMaps) })),
        recent_unresolved: s.recent_unresolved.map((r) => svc.serializeLog(r, { now, user: svc.resolveUserFor(r, userMaps) })),
      };

      logPortalFlow(req, 'Error log stats loaded', {
        layer: LAYER,
        summary: { total: t.total, unresolved: t.unresolved, last24h: t.last_24h, affectedUsers: t.affected_users, services: t.services },
      });
      return res.json({ success: true, data });
    } catch (err) {
      return serverError(req, res, 'Failed to load error log stats', err);
    }
  };

  // GET /meta
  const getMeta = async (req, res) => {
    try {
      const m = await svc.getMeta(docPool);
      return res.json({
        success: true,
        data: {
          timezone: IST_TIMEZONE,
          vocab: {
            sources: svc.SOURCES.map((v) => ({ value: v, label: svc.SOURCE_LABELS[v] })),
            categories: svc.CATEGORIES.map((v) => ({ value: v, label: svc.CATEGORY_LABELS[v] })),
            severities: svc.SEVERITIES.map((v) => ({ value: v, label: svc.SEVERITY_LABELS[v] })),
            status_classes: svc.STATUS_CLASSES,
          },
          used: m,
          sort_options: svc.SORT_OPTIONS,
          user_sort_options: svc.USER_SORT_OPTIONS,
          limits: { max_page_size: 200, max_export_rows: MAX_EXPORT_ROWS, max_bulk_ids: MAX_BULK_IDS },
          permissions: {
            can_resolve: true,
            can_delete: !req.user || DELETE_ROLES.includes(req.user.role),
          },
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load error log metadata', err);
    }
  };

  // GET /
  const listLogs = async (req, res) => {
    try {
      const q = resolveListQuery(req);
      if (q.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', q.error);
      await attachUserMatch(q.filters, q.applied);

      const now = new Date();
      const { rows, total } = await svc.listLogs(docPool, { filters: q.filters, sort: q.sort, page: q.page, limit: q.limit });
      const logs = await serializeWithUsers(rows, now);

      logPortalFlow(req, 'Error logs list loaded', {
        layer: LAYER,
        summary: { total, page: q.page, limit: q.limit, returned: logs.length, ...q.applied },
        table: logs.slice(0, 8).map((e) => ({
          at_ist: e.created_at_ist?.display,
          service: e.service_name,
          type: e.error_type,
          status: e.status_code,
          user: e.user_email || e.user_id,
          resolved: e.is_resolved,
        })),
      });

      return res.json({
        success: true,
        data: {
          logs,
          pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
          filters: q.applied,
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load error logs', err);
    }
  };

  // GET /export  (CSV, same filters as list)
  const exportCsv = async (req, res) => {
    try {
      const q = resolveListQuery(req, { forExport: true });
      if (q.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', q.error);
      await attachUserMatch(q.filters, q.applied);

      const now = new Date();
      const { rows, total } = await svc.listLogs(docPool, { filters: q.filters, sort: q.sort, page: 1, limit: MAX_EXPORT_ROWS });
      const logs = await serializeWithUsers(rows, now);

      const columns = [
        { header: 'ID', key: 'id' },
        { header: 'Occurred (IST)', get: (e) => e.created_at_ist?.display || '' },
        { header: 'Date (IST)', get: (e) => e.created_at_ist?.iso.slice(0, 10) || '' },
        { header: 'Time (IST)', get: (e) => e.created_at_ist?.time24 || '' },
        { header: 'Service', key: 'service_name' },
        { header: 'Environment', key: 'environment' },
        { header: 'Source', key: 'source' },
        { header: 'Category', key: 'category' },
        { header: 'Severity', key: 'severity' },
        { header: 'HTTP status', key: 'status_code' },
        { header: 'Method', key: 'http_method' },
        { header: 'Endpoint', key: 'endpoint' },
        { header: 'Code location', key: 'method' },
        { header: 'Action', key: 'action' },
        { header: 'Resource type', key: 'resource_type' },
        { header: 'Resource id', key: 'resource_id' },
        { header: 'Error type', key: 'error_type' },
        { header: 'Error message', key: 'error_message' },
        { header: 'User message', key: 'user_message' },
        { header: 'User id', key: 'user_id' },
        { header: 'User email', key: 'user_email' },
        { header: 'User name', get: (e) => e.user?.username || '' },
        { header: 'IP address', key: 'ip_address' },
        { header: 'Request id', key: 'request_id' },
        { header: 'External provider', get: (e) => e.external?.provider || '' },
        { header: 'External endpoint', get: (e) => e.external?.endpoint || '' },
        { header: 'External model', get: (e) => e.external?.model || '' },
        { header: 'External status', get: (e) => e.external?.status_code ?? '' },
        { header: 'External error code', get: (e) => e.external?.error_code || '' },
        { header: 'Latency (ms)', key: 'latency_ms' },
        { header: 'Occurrences', key: 'occurrence_count' },
        { header: 'Fingerprint', key: 'fingerprint' },
        { header: 'Resolved', get: (e) => (e.is_resolved ? 'Yes' : 'No') },
        { header: 'Resolved by', key: 'resolved_by' },
        { header: 'Resolved at (IST)', get: (e) => e.resolved_at_ist?.display || '' },
        { header: 'Resolution note', key: 'resolution_note' },
        { header: 'Occurred (UTC)', key: 'created_at' },
      ];

      const stamp = formatIST(now);
      const fileName = `error-logs-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Total-Rows', String(total));
      res.setHeader('X-Exported-Rows', String(logs.length));

      let out = CSV_BOM + csvHeader(columns);
      for (const e of logs) out += csvRow(columns, e);

      logPortalFlow(req, 'Error logs exported to CSV', {
        layer: LAYER,
        summary: { exported: logs.length, total, truncated: total > logs.length, fileName, ...q.applied },
      });
      return res.send(out);
    } catch (err) {
      return serverError(req, res, 'Failed to export error logs', err);
    }
  };

  // GET /users  (errors grouped per user)
  const listUsers = async (req, res) => {
    try {
      const { error, value: q } = validate(usersSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);
      await attachUserMatch(f.filters, f.applied);

      const now = new Date();
      const limit = q.limit || q.pageSize || 20;
      const { rows, total } = await svc.listUsers(docPool, { filters: f.filters, sort: q.sort, page: q.page, limit });
      const maps = await svc.enrichRows(pool, rows, logger);
      const users = rows.map((r) => svc.serializeUserGroup(r, { now, user: svc.resolveUserFor(r, maps) }));

      logPortalFlow(req, 'Error logs per-user list loaded', {
        layer: LAYER,
        summary: { total, page: q.page, limit, returned: users.length, sort: q.sort },
        table: users.slice(0, 8).map((u) => ({ user: u.user_email || u.user_id, name: u.user?.username, total: u.total, unresolved: u.unresolved, last_ist: u.last_error_at_ist?.display })),
      });

      return res.json({
        success: true,
        data: {
          users,
          pagination: { page: q.page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
          filters: { ...f.applied, sort: q.sort },
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load error logs per user', err);
    }
  };

  // GET /issues  (grouped by fingerprint)
  const listIssues = async (req, res) => {
    try {
      const { error, value: q } = validate(issuesSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);
      await attachUserMatch(f.filters, f.applied);

      const now = new Date();
      const rows = await svc.listIssues(docPool, { filters: f.filters, limit: q.limit });
      const issues = rows.map((r) => svc.serializeIssue(r, { now }));

      logPortalFlow(req, 'Error log issues loaded', {
        layer: LAYER,
        summary: { returned: issues.length, limit: q.limit },
        table: issues.slice(0, 8).map((i) => ({ service: i.service_name, type: i.error_type, count: i.count, unresolved: i.unresolved, last_ist: i.last_seen_ist?.display })),
      });
      return res.json({ success: true, data: { issues, filters: f.applied, timezone: IST_TIMEZONE } });
    } catch (err) {
      return serverError(req, res, 'Failed to load error log issues', err);
    }
  };

  // GET /:id
  const getLog = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Error log id must be a UUID');

      const row = await svc.getLogById(docPool, id);
      if (!row) return fail(req, res, 404, 'NOT_FOUND', 'Error log not found');

      const now = new Date();
      const [related, audit] = await Promise.all([svc.getRelated(docPool, row), svc.getAuditForLog(docPool, row, logger)]);
      const maps = await svc.enrichRows(pool, [row, ...related.sameRequest, ...related.sameIssue], logger);

      const log = svc.serializeLog(row, { now, full: true, user: svc.resolveUserFor(row, maps) });
      const issue = row.fingerprint
        ? {
            fingerprint: row.fingerprint,
            count: Number(related.issue.count || 0),
            unresolved: Number(related.issue.unresolved || 0),
            last_24h: Number(related.issue.last_24h || 0),
            affected_users: Number(related.issue.affected_users || 0),
            first_seen: related.issue.first_seen ? new Date(related.issue.first_seen).toISOString() : null,
            first_seen_ist: formatIST(related.issue.first_seen),
            last_seen: related.issue.last_seen ? new Date(related.issue.last_seen).toISOString() : null,
            last_seen_ist: formatIST(related.issue.last_seen),
          }
        : null;

      logPortalFlow(req, 'Error log detail loaded', {
        layer: LAYER,
        summary: { id, service: log.service_name, type: log.error_type, status: log.status_code, user: log.user_email || log.user_id, occurrences: log.occurrence_count },
      });

      return res.json({
        success: true,
        data: {
          log,
          issue,
          audit: svc.serializeAudit(audit),
          related: {
            same_request: related.sameRequest.map((r) => svc.serializeLog(r, { now, user: svc.resolveUserFor(r, maps) })),
            same_issue: related.sameIssue.map((r) => svc.serializeLog(r, { now, user: svc.resolveUserFor(r, maps) })),
          },
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load error log', err);
    }
  };

  // PATCH /:id/resolve   { resolved?: bool (default true), note? }
  const resolveOne = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Error log id must be a UUID');
      const { error, value } = validate(resolveOneSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid payload', error);

      const existing = await svc.getLogById(docPool, id);
      if (!existing) return fail(req, res, 404, 'NOT_FOUND', 'Error log not found');

      const { ids } = await svc.setResolved(docPool, { ids: [id] }, { resolved: value.resolved, note: value.note || null, actor: actorLabel(req) });
      const row = await svc.getLogById(docPool, id);
      const maps = await svc.enrichRows(pool, [row], logger);
      const log = svc.serializeLog(row, { full: true, user: svc.resolveUserFor(row, maps) });

      logPortalFlow(req, value.resolved ? 'Error log resolved' : 'Error log reopened', {
        layer: LAYER,
        summary: { id, changed: ids.length > 0, service: log.service_name, type: log.error_type, note: value.note || null },
      });
      return res.json({ success: true, data: { log, changed: ids.length > 0 } });
    } catch (err) {
      return serverError(req, res, 'Failed to update error log', err);
    }
  };

  // PATCH /resolve   { ids[] | fingerprint, resolved?, note? }
  const resolveBulk = async (req, res) => {
    try {
      const { error, value } = validate(resolveBulkSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid payload', error);

      const target = value.ids ? { ids: value.ids.map((s) => s.toLowerCase()) } : { fingerprint: value.fingerprint };
      const { ids } = await svc.setResolved(docPool, target, { resolved: value.resolved, note: value.note || null, actor: actorLabel(req) });

      logPortalFlow(req, value.resolved ? 'Error logs bulk resolved' : 'Error logs bulk reopened', {
        layer: LAYER,
        summary: { requested: value.ids ? value.ids.length : `fingerprint ${value.fingerprint}`, changed: ids.length, note: value.note || null },
      });
      return res.json({ success: true, data: { resolved: value.resolved, changed: ids.length, ids } });
    } catch (err) {
      return serverError(req, res, 'Failed to update error logs', err);
    }
  };

  // DELETE /:id
  const deleteOne = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Error log id must be a UUID');
      const { ids } = await svc.deleteLogs(docPool, { ids: [id] });
      if (!ids.length) return fail(req, res, 404, 'NOT_FOUND', 'Error log not found');

      logPortalFlow(req, 'Error log deleted', { layer: LAYER, level: 'warn', summary: { id } });
      return res.json({ success: true, data: { deleted: 1, ids } });
    } catch (err) {
      return serverError(req, res, 'Failed to delete error log', err);
    }
  };

  // POST /bulk-delete   { ids[] | fingerprint }
  const deleteBulk = async (req, res) => {
    try {
      const { error, value } = validate(bulkDeleteSchema, req.body);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid payload', error);

      const target = value.ids ? { ids: value.ids.map((s) => s.toLowerCase()) } : { fingerprint: value.fingerprint };
      const { ids } = await svc.deleteLogs(docPool, target);

      logPortalFlow(req, 'Error logs bulk deleted', {
        layer: LAYER,
        level: 'warn',
        summary: { requested: value.ids ? value.ids.length : `fingerprint ${value.fingerprint}`, deleted: ids.length },
      });
      return res.json({ success: true, data: { deleted: ids.length, ids } });
    } catch (err) {
      return serverError(req, res, 'Failed to delete error logs', err);
    }
  };

  return { getStats, getMeta, listLogs, exportCsv, listUsers, listIssues, getLog, resolveOne, resolveBulk, deleteOne, deleteBulk };
}

module.exports = { makeControllers, DELETE_ROLES };
