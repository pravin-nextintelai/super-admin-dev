/**
 * API audit log — data access for `api_audit_logs` (Document_DB, docPool).
 *
 * One row per API call across every backend service, plus one row per error that happened outside
 * a request (jobs, process crashes, browser reports, failed payments). SUCCESS rows have empty error
 * columns; FAILED rows carry the error (and `error_log_id` → error_logs.id) on the same row.
 *
 * The table is OWNED by agentic-document-service (migrations 184/185/186 there). This module only
 * reads it — never creates or alters it. `stack_trace` is only returned by the detail read.
 *
 * Every timestamp leaves this module twice: raw UTC ISO plus an `*_ist` object (utils/time.js).
 */
const { IST_TIMEZONE, formatIST, humanizeDuration } = require('../utils/time');
const errorLogs = require('./errorLogService');

// ── Vocabulary ───────────────────────────────────────────────────────────────

const PING_ENDPOINT = '/api/auth/activity/ping';
const STATUSES = ['SUCCESS', 'FAILED'];
const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE'];
const KINDS = ['request', 'job', 'browser'];
const SORT_OPTIONS = ['newest', 'oldest', 'slowest', 'status', 'service', 'user'];
const SUMMARY_TOP_N = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function kindOf(row) {
  const ep = String(row.endpoint || '');
  if (ep.startsWith('client:')) return 'browser';
  if (ep.startsWith('job:') || ep.startsWith('cron:') || ep.startsWith('process:')) return 'job';
  if (!row.http_method) return 'job';
  return 'request';
}

/** Identity used to group rows per user: user_id wins, else lower-cased email. */
const USER_KEY_SQL = `COALESCE(NULLIF(a.user_id, ''), LOWER(NULLIF(a.user_email, '')))`;
const HAS_USER_SQL = `(NULLIF(a.user_id, '') IS NOT NULL OR NULLIF(a.user_email, '') IS NOT NULL)`;
const PING_SQL = `COALESCE(a.endpoint, '') = '${PING_ENDPOINT}'`;
const BROWSER_SQL = `COALESCE(a.endpoint, '') LIKE 'client:%'`;
const JOB_SQL = `(COALESCE(a.endpoint, '') LIKE 'job:%' OR COALESCE(a.endpoint, '') LIKE 'cron:%' OR COALESCE(a.endpoint, '') LIKE 'process:%' OR a.http_method IS NULL)`;
/** Route template when the service recorded one, else the actual path. */
const ROUTE_SQL = `COALESCE(NULLIF(a.route, ''), a.endpoint)`;

/** Everything except stack_trace (list / export). */
const LIST_COLUMNS = `
  a.id, a.created_at, a.service_name, a.environment, a.request_id,
  a.user_id, a.user_email, a.ip_address, a.user_agent,
  a.http_method, a.endpoint, a.route, a.action, a.resource_type, a.resource_id, a.method,
  a.status, a.status_code, a.duration_ms,
  a.error_log_id, a.error_type, a.error_message, a.user_message,
  (a.stack_trace IS NOT NULL AND a.stack_trace <> '') AS has_stack_trace,
  a.payload
`;

// ── Serialisation ────────────────────────────────────────────────────────────

/**
 * @param {object} row  api_audit_logs row
 * @param {object} opts { now, full, user }  user = enriched Auth-DB user (or null)
 */
function serializeAudit(row, { now = new Date(), full = false, user = null } = {}) {
  if (!row) return null;
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const pl = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
  const statusCode = row.status_code != null ? Number(row.status_code) : null;
  const errorIds = Array.isArray(pl.error_log_ids) && pl.error_log_ids.length ? pl.error_log_ids : row.error_log_id ? [row.error_log_id] : [];
  const failed = String(row.status || '').toUpperCase() === 'FAILED';

  const out = {
    id: row.id,
    created_at: iso(row.created_at),
    created_at_ist: formatIST(row.created_at),
    occurred_ago: createdAt ? humanizeDuration(now.getTime() - createdAt.getTime()) : null,

    service_name: row.service_name,
    environment: row.environment || null,
    request_id: row.request_id || null,

    user_id: row.user_id || (user ? String(user.id) : null),
    user_email: row.user_email || (user && user.email) || null,
    user_email_source: row.user_email ? 'logged' : user && user.email ? 'auth_db' : null,
    user_name: user ? user.username || null : null,
    user_key: row.user_id || (row.user_email ? String(row.user_email).toLowerCase() : null),
    user: user || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,

    kind: kindOf(row),
    http_method: row.http_method || null,
    endpoint: row.endpoint || null,
    route: row.route || null,
    api: [row.http_method, row.endpoint].filter(Boolean).join(' ') || null,

    action: row.action || null,
    resource_type: row.resource_type || null,
    resource_id: row.resource_id || null,
    method: row.method || pl.method || null,

    status: row.status || null,
    failed,
    status_code: statusCode,
    status_class: statusCode ? `${Math.floor(statusCode / 100)}xx` : null,
    duration_ms: row.duration_ms != null ? Number(row.duration_ms) : null,
    duration_display: row.duration_ms != null ? `${Number(row.duration_ms).toLocaleString('en-IN')} ms` : null,
    streaming: pl.streaming === true,

    error_log_id: row.error_log_id || null,
    error_log_ids: errorIds,
    error_type: row.error_type || null,
    error_message: row.error_message || null,
    user_message: row.user_message || null,
    has_stack_trace: full ? Boolean(row.stack_trace) : Boolean(row.has_stack_trace),

    // Optional classification the services may put in payload (source / category / severity / provider)
    source: pl.source || null,
    category: pl.category || null,
    severity: pl.severity || null,
    external_provider: pl.external_provider || null,

    payload: row.payload ?? null,
    timezone: IST_TIMEZONE,
  };
  if (full) out.stack_trace = row.stack_trace || null;
  return out;
}

// ── Filters ──────────────────────────────────────────────────────────────────

/**
 * @param {object} f {
 *   fromAt (Date), toAt (Date), toExclusive (bool),
 *   user, user_match {ids, emails}, services[], environments[], status, methods[], endpoint, route,
 *   resource_types[], actions[], request_id, error_type, status_codes[], status_class, q,
 *   exclude_pings (bool), kind, min_duration_ms, error_log_id
 * }
 */
function buildFilters(f = {}) {
  const where = [];
  const values = [];
  const p = (v) => {
    values.push(v);
    return `$${values.length}`;
  };
  const anyOf = (col, arr, cast = 'text[]') => {
    if (Array.isArray(arr) && arr.length) where.push(`${col} = ANY(${p(arr)}::${cast})`);
  };

  if (f.fromAt instanceof Date && !Number.isNaN(f.fromAt.getTime())) where.push(`a.created_at >= ${p(f.fromAt)}`);
  if (f.toAt instanceof Date && !Number.isNaN(f.toAt.getTime())) where.push(`a.created_at ${f.toExclusive ? '<' : '<='} ${p(f.toAt)}`);

  anyOf('a.service_name', f.services);
  anyOf('a.environment', f.environments);
  anyOf('a.http_method', f.methods);
  anyOf('a.resource_type', f.resource_types);
  anyOf('a.action', f.actions);
  anyOf('a.status_code', f.status_codes, 'int[]');

  if (f.status) where.push(`a.status = ${p(String(f.status).toUpperCase())}`);
  if (f.status_class) {
    const base = Number(String(f.status_class)[0]) * 100;
    where.push(`a.status_code >= ${p(base)} AND a.status_code < ${p(base + 100)}`);
  }

  if (f.user) {
    const u = String(f.user).trim();
    const parts = [`a.user_email ILIKE ${p(`%${escapeLike(u)}%`)}`, `a.user_id = ${p(u)}`];
    if (f.user_match) {
      if (f.user_match.ids.length) parts.push(`a.user_id = ANY(${p(f.user_match.ids)}::text[])`);
      if (f.user_match.emails.length) parts.push(`LOWER(COALESCE(a.user_email, '')) = ANY(${p(f.user_match.emails)}::text[])`);
    }
    where.push(`(${parts.join(' OR ')})`);
  }
  if (f.endpoint) where.push(`COALESCE(a.endpoint, '') ILIKE ${p(`${escapeLike(String(f.endpoint).trim())}%`)}`);
  if (f.route) where.push(`${ROUTE_SQL} ILIKE ${p(`%${escapeLike(String(f.route).trim())}%`)}`);
  if (f.request_id) where.push(`a.request_id = ${p(f.request_id)}`);
  if (f.error_log_id) where.push(`(a.error_log_id = ${p(f.error_log_id)}::uuid OR a.payload->'error_log_ids' ? ${p(f.error_log_id)})`);
  if (f.error_type) where.push(`LOWER(COALESCE(a.error_type, '')) = LOWER(${p(f.error_type)})`);
  if (f.min_duration_ms != null) where.push(`a.duration_ms >= ${p(f.min_duration_ms)}`);
  if (f.kind === 'browser') where.push(BROWSER_SQL);
  else if (f.kind === 'job') where.push(JOB_SQL);
  else if (f.kind === 'request') where.push(`NOT ${BROWSER_SQL} AND NOT ${JOB_SQL}`);
  if (f.exclude_pings) where.push(`NOT ${PING_SQL}`);

  if (f.q) {
    const like = p(`%${escapeLike(String(f.q).trim())}%`);
    where.push(`(
      COALESCE(a.endpoint, '')      ILIKE ${like}
      OR COALESCE(a.route, '')      ILIKE ${like}
      OR COALESCE(a.method, '')     ILIKE ${like}
      OR COALESCE(a.error_type, '') ILIKE ${like}
      OR COALESCE(a.error_message, '') ILIKE ${like}
      OR COALESCE(a.user_message, '')  ILIKE ${like}
      OR COALESCE(a.user_email, '') ILIKE ${like}
      OR COALESCE(a.request_id, '') ILIKE ${like}
      OR COALESCE(a.resource_id, '') ILIKE ${like}
    )`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

function sortSql(sort) {
  switch (sort) {
    case 'oldest':
      return 'a.created_at ASC, a.id ASC';
    case 'slowest':
      return 'a.duration_ms DESC NULLS LAST, a.created_at DESC';
    case 'status':
      return `(a.status = 'FAILED') DESC, a.created_at DESC`;
    case 'service':
      return 'a.service_name ASC, a.created_at DESC';
    case 'user':
      return `${USER_KEY_SQL} ASC NULLS LAST, a.created_at DESC`;
    case 'newest':
    default:
      return 'a.created_at DESC, a.id DESC';
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function listAudit(docPool, { filters = {}, sort = 'newest', page = 1, pageSize = 50 } = {}) {
  const { whereSql, values } = buildFilters(filters);

  const countRes = await docPool.query(`SELECT COUNT(*)::int AS total FROM api_audit_logs a ${whereSql}`, values);
  const total = countRes.rows[0]?.total || 0;

  const offset = (page - 1) * pageSize;
  const listValues = [...values, pageSize, offset];
  const { rows } = await docPool.query(
    `SELECT ${LIST_COLUMNS}
     FROM api_audit_logs a
     ${whereSql}
     ORDER BY ${sortSql(sort)}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );
  return { rows, total };
}

async function getAuditById(docPool, id) {
  const { rows } = await docPool.query(`SELECT a.* FROM api_audit_logs a WHERE a.id = $1`, [id]);
  return rows[0] || null;
}

/**
 * The error_logs rows behind a FAILED audit row: `error_log_id` plus any extra ids in
 * `payload.error_log_ids`. Returns [] when none / the error table is absent. Never throws.
 */
async function getLinkedErrors(docPool, row, logger = null) {
  const pl = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const ids = [...new Set([row.error_log_id, ...(Array.isArray(pl.error_log_ids) ? pl.error_log_ids : [])].filter(Boolean))];
  if (!ids.length) return [];
  try {
    const { rows } = await docPool.query(
      `SELECT e.*, ${errorLogs.DERIVED_COLUMNS}, ${errorLogs.OCCURRENCE_SQL}
       FROM error_logs e WHERE e.id = ANY($1::uuid[]) ORDER BY e.created_at ASC`,
      [ids]
    );
    return rows;
  } catch (err) {
    if (err.code !== '42P01' && logger) logger.warn('Audit logs: linked error lookup failed', { summary: { message: err.message } });
    return [];
  }
}

/** Summary for a period: totals, per service, top endpoints, top users, breakdowns, daily trend. */
async function getSummary(docPool, filters = {}) {
  const { whereSql, values } = buildFilters(filters);
  const top = SUMMARY_TOP_N;

  const [totals, perService, topEndpoints, topUsers, byAction, byResource, byStatusCode, byEnv, trend, slowest] = await Promise.all([
    docPool.query(
      `SELECT COUNT(*)::int AS calls,
              COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed,
              COUNT(*) FILTER (WHERE a.status = 'SUCCESS')::int AS succeeded,
              COUNT(*) FILTER (WHERE a.status_code >= 500)::int AS http_5xx,
              COUNT(*) FILTER (WHERE a.status_code BETWEEN 400 AND 499)::int AS http_4xx,
              COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS distinct_users,
              COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL} AND a.status = 'FAILED')::int AS users_with_failures,
              COUNT(DISTINCT a.service_name)::int AS services,
              COUNT(DISTINCT ${ROUTE_SQL})::int AS distinct_apis,
              COUNT(*) FILTER (WHERE ${BROWSER_SQL})::int AS browser,
              COUNT(*) FILTER (WHERE ${JOB_SQL})::int AS jobs,
              ROUND(AVG(a.duration_ms))::int AS avg_ms,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY a.duration_ms)::int AS p50_ms,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY a.duration_ms)::int AS p95_ms,
              MAX(a.duration_ms)::int AS max_ms,
              MIN(a.created_at) AS first_call_at,
              MAX(a.created_at) AS last_call_at
       FROM api_audit_logs a ${whereSql}`,
      values
    ),
    docPool.query(
      `SELECT a.service_name,
              COUNT(*)::int AS calls,
              COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed,
              ROUND(AVG(a.duration_ms))::int AS avg_ms,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY a.duration_ms)::int AS p50_ms,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY a.duration_ms)::int AS p95_ms,
              MAX(a.duration_ms)::int AS max_ms,
              COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS users,
              COUNT(DISTINCT ${ROUTE_SQL})::int AS apis,
              MAX(a.created_at) AS last_call_at
       FROM api_audit_logs a ${whereSql}
       GROUP BY 1 ORDER BY calls DESC`,
      values
    ),
    docPool.query(
      `SELECT a.service_name, a.http_method, ${ROUTE_SQL} AS route, MIN(a.endpoint) AS endpoint,
              (array_agg(a.method ORDER BY a.created_at DESC) FILTER (WHERE a.method IS NOT NULL))[1] AS method,
              (array_agg(a.action ORDER BY a.created_at DESC) FILTER (WHERE a.action IS NOT NULL))[1] AS action,
              (array_agg(a.resource_type ORDER BY a.created_at DESC) FILTER (WHERE a.resource_type IS NOT NULL))[1] AS resource_type,
              COUNT(*)::int AS calls,
              COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed,
              ROUND(AVG(a.duration_ms))::int AS avg_ms,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY a.duration_ms)::int AS p50_ms,
              COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS users,
              MAX(a.created_at) AS last_call_at
       FROM api_audit_logs a ${whereSql}
       GROUP BY 1, 2, 3 ORDER BY calls DESC LIMIT ${top}`,
      values
    ),
    docPool.query(
      `SELECT ${USER_KEY_SQL} AS user_key,
              MAX(NULLIF(a.user_id, '')) AS user_id,
              MAX(NULLIF(a.user_email, '')) AS user_email,
              COUNT(*)::int AS calls,
              COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed,
              COUNT(DISTINCT a.service_name)::int AS services,
              array_agg(DISTINCT a.service_name) AS service_names,
              COUNT(DISTINCT ${ROUTE_SQL})::int AS apis,
              ROUND(AVG(a.duration_ms))::int AS avg_ms,
              MIN(a.created_at) AS first_call_at,
              MAX(a.created_at) AS last_call_at,
              (array_agg(a.endpoint ORDER BY a.created_at DESC))[1] AS last_endpoint,
              (array_agg(a.http_method ORDER BY a.created_at DESC))[1] AS last_http_method
       FROM api_audit_logs a ${whereSql ? `${whereSql} AND ${HAS_USER_SQL}` : `WHERE ${HAS_USER_SQL}`}
       GROUP BY 1 ORDER BY calls DESC LIMIT ${top}`,
      values
    ),
    docPool.query(
      `SELECT COALESCE(a.action, 'UNKNOWN') AS value, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed
       FROM api_audit_logs a ${whereSql} GROUP BY 1 ORDER BY calls DESC`,
      values
    ),
    docPool.query(
      `SELECT COALESCE(a.resource_type, 'UNKNOWN') AS value, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed
       FROM api_audit_logs a ${whereSql} GROUP BY 1 ORDER BY calls DESC`,
      values
    ),
    docPool.query(
      `SELECT a.status_code AS value, COUNT(*)::int AS calls
       FROM api_audit_logs a ${whereSql ? `${whereSql} AND a.status_code IS NOT NULL` : 'WHERE a.status_code IS NOT NULL'}
       GROUP BY 1 ORDER BY calls DESC LIMIT 12`,
      values
    ),
    docPool.query(
      `SELECT COALESCE(a.environment, 'unknown') AS value, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed
       FROM api_audit_logs a ${whereSql} GROUP BY 1 ORDER BY calls DESC`,
      values
    ),
    docPool.query(
      `SELECT to_char((a.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS date,
              to_char((a.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'DD Mon') AS label,
              COUNT(*)::int AS calls,
              COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS failed,
              COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS users,
              ROUND(AVG(a.duration_ms))::int AS avg_ms
       FROM api_audit_logs a ${whereSql}
       GROUP BY 1, 2 ORDER BY 1`,
      values
    ),
    docPool.query(
      `SELECT ${LIST_COLUMNS} FROM api_audit_logs a
       ${whereSql ? `${whereSql} AND a.duration_ms IS NOT NULL` : 'WHERE a.duration_ms IS NOT NULL'}
       ORDER BY a.duration_ms DESC LIMIT 5`,
      values
    ),
  ]);

  return {
    totals: totals.rows[0],
    per_service: perService.rows,
    top_endpoints: topEndpoints.rows,
    top_users: topUsers.rows,
    by_action: byAction.rows,
    by_resource_type: byResource.rows,
    by_status_code: byStatusCode.rows,
    by_environment: byEnv.rows,
    daily_trend: trend.rows,
    slowest: slowest.rows,
  };
}

/** Distinct values present in the table, for filter dropdowns. */
async function getMeta(docPool) {
  const distinct = (col, { limit = 100, where = '' } = {}) =>
    docPool.query(
      `SELECT ${col} AS value, COUNT(*)::int AS count FROM api_audit_logs a
       WHERE ${col} IS NOT NULL ${where} GROUP BY 1 ORDER BY count DESC, 1 LIMIT ${limit}`
    );
  const [services, environments, resourceTypes, actions, httpMethods, statuses, errorTypes, methods] = await Promise.all([
    distinct('a.service_name'),
    distinct('a.environment'),
    distinct('a.resource_type'),
    distinct('a.action'),
    distinct('a.http_method'),
    distinct('a.status'),
    distinct('a.error_type', { limit: 60 }),
    distinct('a.method', { limit: 100 }),
  ]);
  return {
    services: services.rows,
    environments: environments.rows,
    resource_types: resourceTypes.rows,
    actions: actions.rows,
    http_methods: httpMethods.rows,
    statuses: statuses.rows,
    error_types: errorTypes.rows,
    methods: methods.rows,
  };
}

module.exports = {
  PING_ENDPOINT,
  STATUSES,
  ACTIONS,
  KINDS,
  SORT_OPTIONS,
  SUMMARY_TOP_N,
  serializeAudit,
  buildFilters,
  listAudit,
  getAuditById,
  getLinkedErrors,
  getSummary,
  getMeta,
};
