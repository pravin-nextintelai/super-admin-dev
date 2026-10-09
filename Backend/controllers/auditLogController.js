/**
 * API audit log ("Activity & Error Logs") — controllers.
 *
 *   GET /api/admin/audit-logs/summary   per-service calls / failures / latency, top APIs, top users, trend
 *   GET /api/admin/audit-logs/meta      distinct filter values
 *   GET /api/admin/audit-logs           paginated list (never includes stack_trace)
 *   GET /api/admin/audit-logs/export    CSV, same filters (max 50 000 rows)
 *   GET /api/admin/audit-logs/:id       full row incl. stack_trace + the linked error_logs row(s)
 *
 * Data lives in Document_DB (docPool, table api_audit_logs). Auth and user enrichment use the
 * Auth/Main DB (pool). All timestamps are returned as UTC ISO plus an `*_ist` object.
 */
const Joi = require('joi');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');
const { CSV_BOM, csvHeader, csvRow } = require('../utils/csv');
const { formatIST, IST_TIMEZONE, istDayStart, istDayEndExclusive } = require('../utils/time');
const svc = require('../services/auditLogService');
const errorLogs = require('../services/errorLogService');

const LAYER = 'AUDIT_LOGS';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 50000;
const DEFAULT_WINDOW_HOURS = 24 * 7;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function idParam(req) {
  const id = String(req.params.id || '').trim();
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

function csv(raw, { upper = false } = {}) {
  if (raw === undefined || raw === null || raw === '') return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(parts.map((s) => String(s).trim()).filter(Boolean).map((s) => (upper ? s.toUpperCase() : s)))];
}

/**
 * `from` / `to` accept an IST calendar day (YYYY-MM-DD) or an ISO date-time.
 * A day as `to` is inclusive (bound becomes the next day's start, exclusive).
 */
function parseWhen(value, { isTo = false } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim();
  if (DATE_RE.test(v)) {
    const at = isTo ? istDayEndExclusive(v) : istDayStart(v);
    return at ? { at, exclusive: isTo } : { error: `"${isTo ? 'to' : 'from'}" is not a valid date` };
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { error: `"${isTo ? 'to' : 'from'}" must be YYYY-MM-DD (IST day) or an ISO date-time` };
  return { at: d, exclusive: false };
}

function serverError(req, res, message, err) {
  if (err && err.code === '42P01') {
    logger.errorWithContext('Audit logs: table api_audit_logs does not exist in Document_DB', err, { requestId: req.requestId, layer: LAYER });
    return fail(
      req,
      res,
      503,
      'AUDIT_LOGS_TABLE_MISSING',
      'The api_audit_logs table does not exist in Document_DB yet. It is created by agentic-document-service (migrations 184–186) on its first start.'
    );
  }
  logger.errorWithContext(message, err, { requestId: req.requestId, layer: LAYER });
  return fail(req, res, 500, 'INTERNAL_ERROR', message);
}

function pct(part, whole) {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0;
}

function withIst(row, keys) {
  const out = { ...row };
  for (const k of keys) {
    out[k] = row[k] ? new Date(row[k]).toISOString() : null;
    out[`${k}_ist`] = formatIST(row[k]);
  }
  return out;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const boolish = () => Joi.boolean().truthy('1', 'yes', 'true').falsy('0', 'no', 'false');
const whenStr = () => Joi.string().trim().max(40).allow('');

const commonFilters = {
  from: whenStr(),
  to: whenStr(),
  since_hours: Joi.number().integer().min(1).max(24 * 366),
  user: Joi.string().trim().max(255).allow(''),
  service: Joi.string().trim().max(500).allow(''),
  environment: Joi.string().trim().max(200).allow(''),
  status: Joi.string().trim().uppercase().valid(...svc.STATUSES, 'ALL', ''),
  method: Joi.string().trim().max(100).allow(''),
  endpoint: Joi.string().trim().max(500).allow(''),
  route: Joi.string().trim().max(500).allow(''),
  resource_type: Joi.string().trim().max(500).allow(''),
  action: Joi.string().trim().max(200).allow(''),
  request_id: Joi.string().trim().max(64).allow(''),
  error_log_id: Joi.string().trim().pattern(UUID_RE).allow('').messages({ 'string.pattern.base': '"error_log_id" must be a UUID' }),
  error_type: Joi.string().trim().max(255).allow(''),
  status_code: Joi.string().trim().max(200).allow(''),
  status_class: Joi.string().trim().lowercase().valid('2xx', '3xx', '4xx', '5xx').allow(''),
  q: Joi.string().trim().max(200).allow(''),
  exclude_pings: boolish().default(true),
  kind: Joi.string().trim().lowercase().valid(...svc.KINDS, 'all').allow(''),
  min_duration_ms: Joi.number().integer().min(0),
};

const listSchema = Joi.object({
  ...commonFilters,
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
  sort: Joi.string().trim().lowercase().valid(...svc.SORT_OPTIONS).default('newest'),
});

const summarySchema = Joi.object({ ...commonFilters });

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * @param {import('pg').Pool} pool     Auth / Main DB (admin JWT lookup, users enrichment)
 * @param {import('pg').Pool} docPool  Document_DB (api_audit_logs, error_logs)
 */
function makeControllers(pool, docPool) {
  /** Shared filter resolution (list / export / summary). */
  async function resolveFilters(q) {
    const errors = [];
    const from = parseWhen(q.from);
    const to = parseWhen(q.to, { isTo: true });
    if (from && from.error) errors.push(from.error);
    if (to && to.error) errors.push(to.error);

    const codes = [];
    for (const part of csv(q.status_code)) {
      const n = Number(part);
      if (!Number.isInteger(n) || n < 100 || n > 599) errors.push(`Unknown status_code "${part}" (expected 100–599)`);
      else codes.push(n);
    }
    if (errors.length) return { error: errors };

    let fromAt = from ? from.at : null;
    let toAt = to ? to.at : null;
    const toExclusive = to ? to.exclusive : false;
    if (q.since_hours) fromAt = new Date(Date.now() - q.since_hours * 3600 * 1000);
    if (!fromAt && !q.since_hours) fromAt = new Date(Date.now() - DEFAULT_WINDOW_HOURS * 3600 * 1000);
    if (fromAt && toAt && fromAt > toAt) return { error: ['"from" must be on or before "to"'] };

    const filters = {
      fromAt,
      toAt,
      toExclusive,
      user: q.user || undefined,
      services: csv(q.service),
      environments: csv(q.environment),
      status: q.status && q.status !== 'ALL' ? q.status : undefined,
      methods: csv(q.method, { upper: true }),
      endpoint: q.endpoint || undefined,
      route: q.route || undefined,
      resource_types: csv(q.resource_type).map((s) => s.toUpperCase()),
      actions: csv(q.action, { upper: true }),
      request_id: q.request_id || undefined,
      error_log_id: q.error_log_id ? q.error_log_id.toLowerCase() : undefined,
      error_type: q.error_type || undefined,
      status_codes: codes,
      status_class: q.status_class || undefined,
      q: q.q || undefined,
      exclude_pings: q.exclude_pings !== false,
      kind: q.kind && q.kind !== 'all' ? q.kind : undefined,
      min_duration_ms: q.min_duration_ms,
    };

    let userResolved = null;
    if (filters.user) {
      const m = await errorLogs.resolveUserFilter(pool, filters.user, logger);
      filters.user_match = m;
      userResolved = m.resolved ? { id: m.resolved.id, email: m.resolved.email, username: m.resolved.username } : null;
    }

    const applied = {
      from: fromAt ? fromAt.toISOString() : null,
      from_ist: fromAt ? formatIST(fromAt) : null,
      to: toAt ? toAt.toISOString() : null,
      to_ist: toAt ? formatIST(toAt) : null,
      to_bound: toAt ? (toExclusive ? 'exclusive' : 'inclusive') : null,
      since_hours: q.since_hours || null,
      user: filters.user || null,
      user_resolved: userResolved,
      service: filters.services.length ? filters.services : 'all',
      environment: filters.environments.length ? filters.environments : 'all',
      status: filters.status || 'all',
      method: filters.methods.length ? filters.methods : 'all',
      endpoint: filters.endpoint || null,
      route: filters.route || null,
      resource_type: filters.resource_types.length ? filters.resource_types : 'all',
      action: filters.actions.length ? filters.actions : 'all',
      request_id: filters.request_id || null,
      error_log_id: filters.error_log_id || null,
      error_type: filters.error_type || null,
      status_code: codes.length ? codes : 'all',
      status_class: filters.status_class || null,
      q: filters.q || null,
      exclude_pings: filters.exclude_pings,
      kind: filters.kind || 'all',
      min_duration_ms: filters.min_duration_ms ?? null,
      timezone: IST_TIMEZONE,
    };
    return { filters, applied };
  }

  async function serializeRows(rows, now, { full = false } = {}) {
    const maps = await errorLogs.enrichRows(pool, rows, logger);
    return rows.map((r) => svc.serializeAudit(r, { now, full, user: errorLogs.resolveUserFor(r, maps) }));
  }

  // GET /
  const listAudit = async (req, res) => {
    try {
      const { error, value: q } = validate(listSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = await resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);

      const now = new Date();
      const pageSize = q.page_size || q.limit || DEFAULT_PAGE_SIZE;
      const { rows, total } = await svc.listAudit(docPool, { filters: f.filters, sort: q.sort, page: q.page, pageSize });
      const out = await serializeRows(rows, now);

      logPortalFlow(req, 'Audit logs list loaded', {
        layer: LAYER,
        summary: { total, page: q.page, page_size: pageSize, returned: out.length, sort: q.sort, status: f.applied.status, user: f.applied.user, excludePings: f.applied.exclude_pings },
        table: out.slice(0, 8).map((r) => ({ at_ist: r.created_at_ist?.display, user: r.user_email, service: r.service_name, api: r.api, status: r.status, code: r.status_code, ms: r.duration_ms })),
      });

      return res.json({
        success: true,
        data: {
          rows: out,
          total,
          page: q.page,
          page_size: pageSize,
          total_pages: Math.max(1, Math.ceil(total / pageSize)),
          filters: { ...f.applied, sort: q.sort },
          timezone: IST_TIMEZONE,
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load audit logs', err);
    }
  };

  // GET /export
  const exportCsv = async (req, res) => {
    try {
      const { error, value: q } = validate(listSchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = await resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);

      const now = new Date();
      const { rows, total } = await svc.listAudit(docPool, { filters: f.filters, sort: q.sort, page: 1, pageSize: MAX_EXPORT_ROWS });
      const out = await serializeRows(rows, now);

      const columns = [
        { header: 'ID', key: 'id' },
        { header: 'Timestamp (IST)', get: (r) => r.created_at_ist?.display || '' },
        { header: 'Date (IST)', get: (r) => r.created_at_ist?.iso.slice(0, 10) || '' },
        { header: 'Time (IST)', get: (r) => r.created_at_ist?.time24 || '' },
        { header: 'User email', key: 'user_email' },
        { header: 'User id', key: 'user_id' },
        { header: 'User name', key: 'user_name' },
        { header: 'Service', key: 'service_name' },
        { header: 'Environment', key: 'environment' },
        { header: 'Action', key: 'action' },
        { header: 'Resource type', key: 'resource_type' },
        { header: 'Resource id', key: 'resource_id' },
        { header: 'Method (handler)', key: 'method' },
        { header: 'HTTP method', key: 'http_method' },
        { header: 'Endpoint', key: 'endpoint' },
        { header: 'Route', key: 'route' },
        { header: 'Kind', key: 'kind' },
        { header: 'Status', key: 'status' },
        { header: 'Code', key: 'status_code' },
        { header: 'Duration (ms)', key: 'duration_ms' },
        { header: 'IP address', key: 'ip_address' },
        { header: 'User agent', key: 'user_agent' },
        { header: 'Request id', key: 'request_id' },
        { header: 'Error type', key: 'error_type' },
        { header: 'Error message', key: 'error_message' },
        { header: 'User message', key: 'user_message' },
        { header: 'Error log id', key: 'error_log_id' },
        { header: 'Timestamp (UTC)', key: 'created_at' },
      ];

      const stamp = formatIST(now);
      const fileName = `audit-logs-${stamp.iso.slice(0, 10)}-${stamp.time24.replace(':', '')}-IST.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Total-Rows', String(total));
      res.setHeader('X-Exported-Rows', String(out.length));

      let body = CSV_BOM + csvHeader(columns);
      for (const r of out) body += csvRow(columns, r);

      logPortalFlow(req, 'Audit logs exported to CSV', {
        layer: LAYER,
        summary: { exported: out.length, total, truncated: total > out.length, fileName, status: f.applied.status, user: f.applied.user },
      });
      return res.send(body);
    } catch (err) {
      return serverError(req, res, 'Failed to export audit logs', err);
    }
  };

  // GET /summary
  const getSummary = async (req, res) => {
    try {
      const { error, value: q } = validate(summarySchema, req.query);
      if (error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', error);
      const f = await resolveFilters(q);
      if (f.error) return fail(req, res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', f.error);

      const now = new Date();
      const s = await svc.getSummary(docPool, f.filters);
      const t = s.totals;
      const userMaps = await errorLogs.enrichRows(pool, [...s.top_users, ...s.slowest], logger);
      const topEndpoints = s.top_endpoints.map((r) => ({ ...withIst(r, ['last_call_at']), failure_rate_pct: pct(r.failed, r.calls) }));
      const mostUsed = topEndpoints[0] || null;

      const data = {
        timezone: IST_TIMEZONE,
        generated_at: now.toISOString(),
        generated_at_ist: formatIST(now),
        period: {
          from: f.applied.from,
          from_ist: f.applied.from_ist,
          to: f.applied.to,
          to_ist: f.applied.to_ist,
          since_hours: f.applied.since_hours,
        },
        filters: f.applied,
        totals: {
          calls: t.calls,
          succeeded: t.succeeded,
          failed: t.failed,
          failure_rate_pct: pct(t.failed, t.calls),
          http_4xx: t.http_4xx,
          http_5xx: t.http_5xx,
          distinct_users: t.distinct_users,
          users_with_failures: t.users_with_failures,
          services: t.services,
          distinct_apis: t.distinct_apis,
          browser: t.browser,
          jobs: t.jobs,
          avg_ms: t.avg_ms ?? null,
          p50_ms: t.p50_ms ?? null,
          p95_ms: t.p95_ms ?? null,
          max_ms: t.max_ms ?? null,
          first_call_at: t.first_call_at ? new Date(t.first_call_at).toISOString() : null,
          first_call_at_ist: formatIST(t.first_call_at),
          last_call_at: t.last_call_at ? new Date(t.last_call_at).toISOString() : null,
          last_call_at_ist: formatIST(t.last_call_at),
          most_used_api: mostUsed
            ? { service_name: mostUsed.service_name, http_method: mostUsed.http_method, route: mostUsed.route, endpoint: mostUsed.endpoint, calls: mostUsed.calls, failed: mostUsed.failed }
            : null,
        },
        per_service: s.per_service.map((r) => ({ ...withIst(r, ['last_call_at']), failure_rate_pct: pct(r.failed, r.calls) })),
        top_endpoints: topEndpoints,
        top_users: s.top_users.map((r) => {
          const user = errorLogs.resolveUserFor(r, userMaps);
          return {
            ...withIst(r, ['first_call_at', 'last_call_at']),
            user_id: r.user_id || (user ? String(user.id) : null),
            user_email: r.user_email || (user && user.email) || null,
            user_name: user ? user.username || null : null,
            user,
            services: Array.isArray(r.service_names) ? r.service_names.filter(Boolean) : [],
            service_names: undefined,
            failure_rate_pct: pct(r.failed, r.calls),
          };
        }),
        by_action: s.by_action,
        by_resource_type: s.by_resource_type,
        by_status_code: s.by_status_code,
        by_environment: s.by_environment,
        daily_trend: s.daily_trend,
        slowest: s.slowest.map((r) => svc.serializeAudit(r, { now, user: errorLogs.resolveUserFor(r, userMaps) })),
      };

      logPortalFlow(req, 'Audit log summary loaded', {
        layer: LAYER,
        summary: { calls: t.calls, failed: t.failed, failureRatePct: data.totals.failure_rate_pct, users: t.distinct_users, avgMs: t.avg_ms, from: f.applied.from, to: f.applied.to },
      });
      return res.json({ success: true, data });
    } catch (err) {
      return serverError(req, res, 'Failed to load audit log summary', err);
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
          vocab: { statuses: svc.STATUSES, actions: svc.ACTIONS, kinds: svc.KINDS, status_classes: ['2xx', '3xx', '4xx', '5xx'] },
          used: m,
          sort_options: svc.SORT_OPTIONS,
          defaults: { page_size: DEFAULT_PAGE_SIZE, window_hours: DEFAULT_WINDOW_HOURS, exclude_pings: true, ping_endpoint: svc.PING_ENDPOINT },
          limits: { max_page_size: MAX_PAGE_SIZE, max_export_rows: MAX_EXPORT_ROWS },
        },
      });
    } catch (err) {
      return serverError(req, res, 'Failed to load audit log metadata', err);
    }
  };

  // GET /:id
  const getAudit = async (req, res) => {
    try {
      const id = idParam(req);
      if (!id) return fail(req, res, 400, 'VALIDATION_ERROR', 'Audit log id must be a UUID');

      const row = await svc.getAuditById(docPool, id);
      if (!row) return fail(req, res, 404, 'NOT_FOUND', 'Audit log not found');

      const now = new Date();
      const linked = await svc.getLinkedErrors(docPool, row, logger);
      const maps = await errorLogs.enrichRows(pool, [row, ...linked], logger);
      const audit = svc.serializeAudit(row, { now, full: true, user: errorLogs.resolveUserFor(row, maps) });
      const errors = linked.map((e) => errorLogs.serializeLog(e, { now, full: true, user: errorLogs.resolveUserFor(e, maps) }));
      const primary = errors.find((e) => e.id === row.error_log_id) || errors[0] || null;

      logPortalFlow(req, 'Audit log detail loaded', {
        layer: LAYER,
        summary: { id, service: audit.service_name, api: audit.api, status: audit.status, code: audit.status_code, user: audit.user_email, linkedErrors: errors.length },
      });
      return res.json({ success: true, data: { audit, error: primary, errors, timezone: IST_TIMEZONE } });
    } catch (err) {
      return serverError(req, res, 'Failed to load audit log', err);
    }
  };

  return { listAudit, exportCsv, getSummary, getMeta, getAudit };
}

module.exports = { makeControllers };
