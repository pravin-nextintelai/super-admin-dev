/**
 * Error logs — data access for the platform-wide `error_logs` table.
 *
 * Backing table: `public.error_logs` in Document_DB (docPool). The table is OWNED by
 * agentic-document-service (migration 183_error_logs.sql there); every other service writes
 * into it directly or through that service's POST /internal/error-logs. This module only
 * reads, resolves and deletes rows — it never creates or alters the table.
 *
 * Optional enrichment: `user_id` / `user_email` on a row are looked up in the Auth DB `users`
 * table (pool) so the dashboard can show who the user is. The two databases cannot be joined,
 * so that is a second query on the page's distinct ids/emails.
 *
 * Every timestamp leaves this module twice: raw UTC ISO plus an `*_ist` object (utils/time.js).
 */
const { IST_TIMEZONE, formatIST, istDayStart, istDayEndExclusive, humanizeDuration } = require('../utils/time');

// ── Vocabulary (mirrors the CHECK-less VARCHAR columns; other services may add values) ──

const SOURCES = ['HTTP', 'EXTERNAL_API', 'JOB', 'LOGGER', 'PROCESS'];
const SOURCE_LABELS = {
  HTTP: 'HTTP request',
  EXTERNAL_API: 'External API call',
  JOB: 'Background job',
  LOGGER: 'Logged error',
  PROCESS: 'Process crash',
};

const CATEGORIES = [
  'INTERNAL',
  'DATABASE',
  'TIMEOUT',
  'AI_PROVIDER',
  'AI_SAFETY_BLOCK',
  'AI_EMPTY_RESPONSE',
  'AI_INVALID_OUTPUT',
  'CITATION_PROVIDER',
  'EXTERNAL_API',
];
const CATEGORY_LABELS = {
  INTERNAL: 'Internal error',
  DATABASE: 'Database',
  TIMEOUT: 'Timeout',
  AI_PROVIDER: 'AI provider',
  AI_SAFETY_BLOCK: 'AI safety block',
  AI_EMPTY_RESPONSE: 'AI empty response',
  AI_INVALID_OUTPUT: 'AI invalid output',
  CITATION_PROVIDER: 'Citation provider',
  EXTERNAL_API: 'External API',
};

const SEVERITIES = ['CRITICAL', 'ERROR', 'WARNING'];
const SEVERITY_LABELS = { CRITICAL: 'Critical', ERROR: 'Error', WARNING: 'Warning' };

const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx'];

const SORT_OPTIONS = ['newest', 'oldest', 'severity', 'service', 'status_code', 'latency', 'user'];

const USER_SORT_OPTIONS = ['most_errors', 'recent', 'unresolved', 'critical'];

const TREND_DAYS = 14;

// ── Helpers ──────────────────────────────────────────────────────────────────

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function labelFor(map, value) {
  if (!value) return null;
  return map[value] || String(value).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/** Identity used to group rows per user: user_id wins, else lower-cased email. */
const USER_KEY_SQL = `COALESCE(NULLIF(e.user_id, ''), LOWER(NULLIF(e.user_email, '')))`;
const HAS_USER_SQL = `(NULLIF(e.user_id, '') IS NOT NULL OR NULLIF(e.user_email, '') IS NOT NULL)`;

// NOTE: every predicate below is COALESCE-guarded so it is TRUE or FALSE, never NULL — `NOT (…)`
// on a NULL (endpoint / payload key absent) would silently drop the row from "server" / "exclude_debug" views.

/** Browser-side reports (frontend clientErrorReporter / Razorpay flows): endpoint `client:<flow>` + payload.client_report. */
const BROWSER_SQL = `(COALESCE(e.endpoint, '') LIKE 'client:%' OR COALESCE(e.payload->>'client_report', '') = 'true')`;
/** Rows produced by the errorlog debug routes / demo triggers, not by real traffic. */
const DEBUG_SQL = `(COALESCE(e.endpoint, '') LIKE '/internal/error-logs/_debug%' OR COALESCE(e.endpoint, '') LIKE '/__demo/%' OR COALESCE(e.error_message, '') LIKE 'errorlog debug%' OR COALESCE(e.error_message, '') LIKE 'demo:%')`;
/** A failure the request recovered from (final status 2xx/3xx) — stored only with ERROR_LOG_CAPTURE_ALL / STORE_RECOVERED_EXTERNAL. */
const RECOVERED_SQL = `(COALESCE(e.payload->>'recovered', '') = 'true')`;
/** The route template is `payload.route` (endpoint holds the actual path with ids). */
const ROUTE_SQL = `COALESCE(NULLIF(e.payload->>'route', ''), e.endpoint)`;

/**
 * Lightweight values lifted out of `payload` so list views can show them without shipping the
 * whole JSON (see "Central error logging" doc: route, recovered, attempts, after_response_start,
 * related, http_detail, browser report kind/flow/page).
 */
const DERIVED_COLUMNS = `
  e.payload->>'route' AS route,
  CASE WHEN e.payload->>'recovered' IN ('true', 'false') THEN (e.payload->>'recovered')::boolean END AS recovered,
  CASE WHEN e.payload->>'attempts' ~ '^[0-9]+$' THEN (e.payload->>'attempts')::int END AS attempts,
  CASE WHEN e.payload->>'after_response_start' IN ('true', 'false') THEN (e.payload->>'after_response_start')::boolean END AS after_response_start,
  CASE WHEN jsonb_typeof(e.payload->'related') = 'array' THEN jsonb_array_length(e.payload->'related') ELSE 0 END AS related_count,
  e.payload->>'http_detail' AS http_detail,
  e.payload->>'kind' AS client_kind,
  e.payload->>'flow' AS client_flow,
  e.payload->>'page' AS client_page,
  ${BROWSER_SQL} AS is_browser,
  ${DEBUG_SQL} AS is_debug
`;

/** Columns returned in list views (heavy text columns are left to the detail view). */
const LIST_COLUMNS = `
  e.id, e.created_at, e.service_name, e.environment, e.source, e.category, e.severity,
  e.request_id, e.user_id, e.user_email, e.ip_address,
  e.endpoint, e.http_method, e.method, e.action, e.resource_type, e.resource_id, e.status_code,
  e.user_message, e.error_type, e.error_message,
  (e.stack_trace IS NOT NULL AND e.stack_trace <> '') AS has_stack_trace,
  e.external_provider, e.external_endpoint, e.external_model, e.external_status_code, e.external_error_code,
  (e.external_response IS NOT NULL AND e.external_response <> '') AS has_external_response,
  (e.payload IS NOT NULL) AS has_payload,
  e.latency_ms, e.fingerprint,
  e.is_resolved, e.resolved_by, e.resolved_at, e.resolution_note,
  ${DERIVED_COLUMNS}
`;

const OCCURRENCE_SQL = `
  (SELECT COUNT(*)::int FROM error_logs x WHERE x.fingerprint = e.fingerprint) AS occurrence_count,
  (SELECT COUNT(*)::int FROM error_logs x WHERE x.fingerprint = e.fingerprint AND NOT x.is_resolved) AS unresolved_occurrences
`;

// ── Serialisation ────────────────────────────────────────────────────────────

/**
 * @param {object} row  error_logs row (list or detail columns)
 * @param {object} opts { now, full, user }  user = enriched Auth-DB user (or null)
 */
function serializeLog(row, { now = new Date(), full = false, user = null } = {}) {
  if (!row) return null;
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const statusCode = row.status_code != null ? Number(row.status_code) : null;
  const pl = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
  const isBrowser =
    typeof row.is_browser === 'boolean'
      ? row.is_browser
      : String(row.endpoint || '').startsWith('client:') || pl.client_report === true;
  const isDebug =
    typeof row.is_debug === 'boolean'
      ? row.is_debug
      : /^\/internal\/error-logs\/_debug|^\/__demo\//.test(String(row.endpoint || '')) || /^(errorlog debug|demo:)/.test(String(row.error_message || ''));
  const relatedCount =
    row.related_count != null ? Number(row.related_count) : Array.isArray(pl.related) ? pl.related.length : 0;

  const out = {
    id: row.id,
    created_at: iso(row.created_at),
    created_at_ist: formatIST(row.created_at),
    occurred_ago: createdAt ? humanizeDuration(now.getTime() - createdAt.getTime()) : null,

    service_name: row.service_name,
    environment: row.environment || null,
    source: row.source,
    source_label: labelFor(SOURCE_LABELS, row.source),
    category: row.category,
    category_label: labelFor(CATEGORY_LABELS, row.category),
    severity: row.severity,
    severity_label: labelFor(SEVERITY_LABELS, row.severity),

    request_id: row.request_id || null,
    // user_id / user_email as the service recorded them; when one is missing it is filled
    // from the Auth DB user resolved for the row (user_email_source says which).
    user_id: row.user_id || (user ? String(user.id) : null),
    user_email: row.user_email || (user && user.email) || null,
    user_email_source: row.user_email ? 'logged' : user && user.email ? 'auth_db' : null,
    user_name: user ? user.username || null : null,
    user_key: row.user_id || (row.user_email ? String(row.user_email).toLowerCase() : null),
    user: user || null,
    ip_address: row.ip_address || null,

    endpoint: row.endpoint || null,
    http_method: row.http_method || null,
    method: row.method || null,
    action: row.action || null,
    resource_type: row.resource_type || null,
    resource_id: row.resource_id || null,
    status_code: statusCode,
    status_class: statusCode ? `${Math.floor(statusCode / 100)}xx` : null,

    user_message: row.user_message || null,
    error_type: row.error_type || null,
    error_message: row.error_message || null,
    has_stack_trace: full ? Boolean(row.stack_trace) : Boolean(row.has_stack_trace),

    external: row.external_provider || row.external_endpoint || row.external_status_code != null || row.external_error_code
      ? {
          provider: row.external_provider || null,
          endpoint: row.external_endpoint || null,
          model: row.external_model || null,
          status_code: row.external_status_code != null ? Number(row.external_status_code) : null,
          error_code: row.external_error_code || null,
          has_response: full ? Boolean(row.external_response) : Boolean(row.has_external_response),
        }
      : null,

    latency_ms: row.latency_ms != null ? Number(row.latency_ms) : null,
    latency_display: row.latency_ms != null ? `${Number(row.latency_ms).toLocaleString('en-IN')} ms` : null,
    fingerprint: row.fingerprint || null,
    occurrence_count: row.occurrence_count != null ? Math.max(1, Number(row.occurrence_count)) : null,
    unresolved_occurrences: row.unresolved_occurrences != null ? Number(row.unresolved_occurrences) : null,
    has_payload: full ? row.payload != null : Boolean(row.has_payload),

    // Lifted from payload (see "Central error logging" → The table → payload)
    origin: isBrowser ? 'browser' : 'server',
    route: row.route || pl.route || null,
    recovered: typeof row.recovered === 'boolean' ? row.recovered : pl.recovered === true,
    attempts: row.attempts != null ? Number(row.attempts) : Number.isInteger(pl.attempts) ? pl.attempts : null,
    after_response_start:
      typeof row.after_response_start === 'boolean' ? row.after_response_start : pl.after_response_start === true,
    related_count: relatedCount,
    http_detail: row.http_detail || pl.http_detail || null,
    client: isBrowser
      ? { kind: row.client_kind || pl.kind || null, flow: row.client_flow || pl.flow || null, page: row.client_page || pl.page || null }
      : null,
    is_debug: Boolean(isDebug),

    is_resolved: Boolean(row.is_resolved),
    resolved_by: row.resolved_by || null,
    resolved_at: iso(row.resolved_at),
    resolved_at_ist: formatIST(row.resolved_at),
    resolution_note: row.resolution_note || null,

    timezone: IST_TIMEZONE,
  };

  if (full) {
    out.stack_trace = row.stack_trace || null;
    out.payload = row.payload ?? null;
    if (out.external) out.external.response = row.external_response || null;
  }
  return out;
}

function serializeUserGroup(row, { now = new Date(), user = null } = {}) {
  const lastAt = row.last_error_at ? new Date(row.last_error_at) : null;
  return {
    user_key: row.user_key,
    user_id: row.user_id || (user ? String(user.id) : null),
    user_email: row.user_email || (user && user.email) || null,
    user_email_source: row.user_email ? 'logged' : user && user.email ? 'auth_db' : null,
    user_name: user ? user.username || null : null,
    user: user || null,
    total: Number(row.total || 0),
    unresolved: Number(row.unresolved || 0),
    critical: Number(row.critical || 0),
    last_24h: Number(row.last_24h || 0),
    last_7_days: Number(row.last_7_days || 0),
    distinct_errors: Number(row.distinct_errors || 0),
    services: Array.isArray(row.service_names) ? row.service_names.filter(Boolean) : [],
    first_error_at: iso(row.first_error_at),
    first_error_at_ist: formatIST(row.first_error_at),
    last_error_at: iso(row.last_error_at),
    last_error_at_ist: formatIST(row.last_error_at),
    last_error_ago: lastAt ? humanizeDuration(now.getTime() - lastAt.getTime()) : null,
    last_error_type: row.last_error_type || null,
    last_error_message: row.last_error_message || null,
    last_endpoint: row.last_endpoint || null,
    last_service: row.last_service || null,
  };
}

function serializeIssue(row, { now = new Date() } = {}) {
  const lastAt = row.last_seen ? new Date(row.last_seen) : null;
  return {
    fingerprint: row.fingerprint,
    service_name: row.service_name,
    services: Array.isArray(row.service_names) ? row.service_names.filter(Boolean) : [],
    source: row.source || null,
    category: row.category || null,
    category_label: labelFor(CATEGORY_LABELS, row.category),
    severity: row.severity || null,
    error_type: row.error_type || null,
    error_message: row.error_message || null,
    endpoint: row.endpoint || null,
    http_method: row.http_method || null,
    status_code: row.status_code != null ? Number(row.status_code) : null,
    count: Number(row.count || 0),
    unresolved: Number(row.unresolved || 0),
    last_24h: Number(row.last_24h || 0),
    affected_users: Number(row.affected_users || 0),
    first_seen: iso(row.first_seen),
    first_seen_ist: formatIST(row.first_seen),
    last_seen: iso(row.last_seen),
    last_seen_ist: formatIST(row.last_seen),
    last_seen_ago: lastAt ? humanizeDuration(now.getTime() - lastAt.getTime()) : null,
    latest_id: row.latest_id || null,
  };
}

// ── Filters ──────────────────────────────────────────────────────────────────

/**
 * @param {object} f {
 *   services[], environments[], sources[], categories[], severities[], status_codes[], status_class,
 *   error_type, provider, user, user_id, user_email, request_id, fingerprint, endpoint, method,
 *   resolved (bool|undefined), has_user (bool|undefined), search, from, to, since (Date)
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

  anyOf('e.service_name', f.services);
  anyOf('e.environment', f.environments);
  anyOf('e.source', f.sources);
  anyOf('e.category', f.categories);
  anyOf('e.severity', f.severities);
  anyOf('e.status_code', f.status_codes, 'int[]');

  if (f.status_class && STATUS_CLASSES.includes(f.status_class)) {
    const base = Number(f.status_class[0]) * 100;
    where.push(`e.status_code >= ${p(base)} AND e.status_code < ${p(base + 100)}`);
  }
  if (f.error_type) where.push(`LOWER(COALESCE(e.error_type, '')) = LOWER(${p(f.error_type)})`);
  if (f.provider) where.push(`LOWER(COALESCE(e.external_provider, '')) = LOWER(${p(f.provider)})`);
  if (f.user_match && (f.user_match.ids.length || f.user_match.emails.length)) {
    // Resolved through the Auth DB (see resolveUserFilter): an email also finds rows that only
    // recorded the user id, and vice versa.
    const parts = [];
    if (f.user_match.ids.length) parts.push(`e.user_id = ANY(${p(f.user_match.ids)}::text[])`);
    if (f.user_match.emails.length) parts.push(`LOWER(COALESCE(e.user_email, '')) = ANY(${p(f.user_match.emails)}::text[])`);
    where.push(`(${parts.join(' OR ')})`);
  } else if (f.user) {
    const u = String(f.user).trim();
    where.push(`(e.user_id = ${p(u)} OR LOWER(COALESCE(e.user_email, '')) = LOWER(${p(u)}))`);
  }
  if (f.user_id) where.push(`e.user_id = ${p(String(f.user_id))}`);
  if (f.user_email) where.push(`LOWER(COALESCE(e.user_email, '')) = LOWER(${p(f.user_email)})`);
  if (f.request_id) where.push(`e.request_id = ${p(f.request_id)}`);
  if (f.fingerprint) where.push(`e.fingerprint = ${p(f.fingerprint)}`);
  if (f.endpoint) where.push(`COALESCE(e.endpoint, '') ILIKE ${p(`%${escapeLike(f.endpoint)}%`)}`);
  if (f.route) where.push(`${ROUTE_SQL} ILIKE ${p(`%${escapeLike(f.route)}%`)}`);
  if (f.method) where.push(`COALESCE(e.method, '') ILIKE ${p(`%${escapeLike(f.method)}%`)}`);
  if (typeof f.resolved === 'boolean') where.push(`e.is_resolved = ${p(f.resolved)}`);
  if (typeof f.has_user === 'boolean') where.push(f.has_user ? HAS_USER_SQL : `NOT ${HAS_USER_SQL}`);
  if (f.origin === 'browser') where.push(BROWSER_SQL);
  else if (f.origin === 'server') where.push(`NOT ${BROWSER_SQL}`);
  if (f.exclude_debug) where.push(`NOT ${DEBUG_SQL}`);

  if (f.search) {
    const like = p(`%${escapeLike(String(f.search).trim())}%`);
    where.push(`(
      COALESCE(e.error_message, '')     ILIKE ${like}
      OR COALESCE(e.user_message, '')   ILIKE ${like}
      OR COALESCE(e.error_type, '')     ILIKE ${like}
      OR COALESCE(e.endpoint, '')       ILIKE ${like}
      OR COALESCE(e.method, '')         ILIKE ${like}
      OR COALESCE(e.user_email, '')     ILIKE ${like}
      OR COALESCE(e.user_id, '')        ILIKE ${like}
      OR COALESCE(e.request_id, '')     ILIKE ${like}
      OR COALESCE(e.resource_id, '')    ILIKE ${like}
      OR COALESCE(e.ip_address, '')     ILIKE ${like}
      OR COALESCE(e.service_name, '')   ILIKE ${like}
      OR COALESCE(e.external_endpoint, '') ILIKE ${like}
      OR COALESCE(e.external_error_code, '') ILIKE ${like}
    )`);
  }
  if (f.from) {
    const start = istDayStart(f.from);
    if (start) where.push(`e.created_at >= ${p(start)}`);
  }
  if (f.to) {
    const end = istDayEndExclusive(f.to);
    if (end) where.push(`e.created_at < ${p(end)}`);
  }
  if (f.since instanceof Date && !Number.isNaN(f.since.getTime())) {
    where.push(`e.created_at >= ${p(f.since)}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

function sortSql(sort) {
  switch (sort) {
    case 'oldest':
      return 'e.created_at ASC, e.id ASC';
    case 'severity':
      return `array_position(ARRAY['CRITICAL','ERROR','WARNING']::text[], e.severity) NULLS LAST, e.created_at DESC`;
    case 'service':
      return 'e.service_name ASC, e.created_at DESC';
    case 'status_code':
      return 'e.status_code DESC NULLS LAST, e.created_at DESC';
    case 'latency':
      return 'e.latency_ms DESC NULLS LAST, e.created_at DESC';
    case 'user':
      return `${USER_KEY_SQL} ASC NULLS LAST, e.created_at DESC`;
    case 'newest':
    default:
      return 'e.created_at DESC, e.id DESC';
  }
}

function userSortSql(sort) {
  switch (sort) {
    case 'recent':
      return 'last_error_at DESC';
    case 'unresolved':
      return 'unresolved DESC, last_error_at DESC';
    case 'critical':
      return 'critical DESC, total DESC, last_error_at DESC';
    case 'most_errors':
    default:
      return 'total DESC, last_error_at DESC';
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function listLogs(docPool, { filters = {}, sort = 'newest', page = 1, limit = 20 } = {}) {
  const { whereSql, values } = buildFilters(filters);

  const countRes = await docPool.query(`SELECT COUNT(*)::int AS total FROM error_logs e ${whereSql}`, values);
  const total = countRes.rows[0]?.total || 0;

  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const { rows } = await docPool.query(
    `SELECT ${LIST_COLUMNS}, ${OCCURRENCE_SQL}
     FROM error_logs e
     ${whereSql}
     ORDER BY ${sortSql(sort)}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );
  return { rows, total };
}

async function getLogById(docPool, id) {
  const { rows } = await docPool.query(
    `SELECT e.*, ${DERIVED_COLUMNS}, ${OCCURRENCE_SQL} FROM error_logs e WHERE e.id = $1`,
    [id]
  );
  return rows[0] || null;
}

const AUDIT_COLUMNS = `
  a.id, a.created_at, a.service_name, a.environment, a.request_id, a.user_id, a.user_email, a.ip_address, a.user_agent,
  a.http_method, a.endpoint, a.route, a.status_code, a.status, a.duration_ms, a.error_log_id,
  a.error_type, a.error_message, a.user_message, a.action, a.method, a.resource_type, a.resource_id, a.payload
`;

/**
 * The `api_audit_logs` row for the request that produced an error row (one audit row per request;
 * a failed one stores `error_log_id`). Matched by error_log_id first, then by request_id + service.
 * Returns null when there is none or the audit table does not exist. Never throws.
 */
async function getAuditForLog(docPool, row, logger = null) {
  try {
    let r = await docPool.query(
      `SELECT ${AUDIT_COLUMNS} FROM api_audit_logs a WHERE a.error_log_id = $1 ORDER BY a.created_at DESC LIMIT 1`,
      [row.id]
    );
    if (r.rows[0]) return { ...r.rows[0], matched_by: 'error_log_id' };
    if (!row.request_id) return null;
    r = await docPool.query(
      `SELECT ${AUDIT_COLUMNS} FROM api_audit_logs a
       WHERE a.request_id = $1 AND a.service_name = $2
       ORDER BY (a.status = 'FAILED') DESC, a.created_at DESC LIMIT 1`,
      [row.request_id, row.service_name]
    );
    return r.rows[0] ? { ...r.rows[0], matched_by: 'request_id' } : null;
  } catch (err) {
    if (err.code !== '42P01' && logger) logger.warn('Error logs: api_audit_logs lookup failed', { summary: { message: err.message } });
    return null;
  }
}

function serializeAudit(a) {
  if (!a) return null;
  return {
    id: a.id,
    created_at: iso(a.created_at),
    created_at_ist: formatIST(a.created_at),
    service_name: a.service_name,
    environment: a.environment || null,
    request_id: a.request_id || null,
    user_id: a.user_id || null,
    user_email: a.user_email || null,
    ip_address: a.ip_address || null,
    user_agent: a.user_agent || null,
    http_method: a.http_method || null,
    endpoint: a.endpoint || null,
    route: a.route || null,
    status_code: a.status_code != null ? Number(a.status_code) : null,
    status: a.status || null,
    duration_ms: a.duration_ms != null ? Number(a.duration_ms) : null,
    error_log_id: a.error_log_id || null,
    error_type: a.error_type || null,
    error_message: a.error_message || null,
    user_message: a.user_message || null,
    action: a.action || null,
    method: a.method || null,
    resource_type: a.resource_type || null,
    resource_id: a.resource_id || null,
    payload: a.payload ?? null,
    matched_by: a.matched_by || null,
  };
}

/** Rows that share the request id or the fingerprint of a given row (for the detail drawer). */
async function getRelated(docPool, row, { limit = 10 } = {}) {
  const [sameRequest, sameIssue, issueSummary] = await Promise.all([
    row.request_id
      ? docPool.query(
          `SELECT ${LIST_COLUMNS}, ${OCCURRENCE_SQL} FROM error_logs e
           WHERE e.request_id = $1 AND e.id <> $2
           ORDER BY e.created_at ASC LIMIT $3`,
          [row.request_id, row.id, limit]
        )
      : Promise.resolve({ rows: [] }),
    row.fingerprint
      ? docPool.query(
          `SELECT ${LIST_COLUMNS}, ${OCCURRENCE_SQL} FROM error_logs e
           WHERE e.fingerprint = $1 AND e.id <> $2
           ORDER BY e.created_at DESC LIMIT $3`,
          [row.fingerprint, row.id, limit]
        )
      : Promise.resolve({ rows: [] }),
    row.fingerprint
      ? docPool.query(
          `SELECT COUNT(*)::int AS count,
                  COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
                  COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
                  COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS affected_users,
                  MIN(e.created_at) AS first_seen, MAX(e.created_at) AS last_seen
           FROM error_logs e WHERE e.fingerprint = $1`,
          [row.fingerprint]
        )
      : Promise.resolve({ rows: [{}] }),
  ]);
  return { sameRequest: sameRequest.rows, sameIssue: sameIssue.rows, issue: issueSummary.rows[0] || {} };
}

/** Errors grouped per user (user_id, else email). */
async function listUsers(docPool, { filters = {}, sort = 'most_errors', page = 1, limit = 20 } = {}) {
  const { whereSql, values } = buildFilters({ ...filters, has_user: true });

  const countRes = await docPool.query(
    `SELECT COUNT(DISTINCT ${USER_KEY_SQL})::int AS total FROM error_logs e ${whereSql}`,
    values
  );
  const total = countRes.rows[0]?.total || 0;

  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const { rows } = await docPool.query(
    `SELECT ${USER_KEY_SQL} AS user_key,
            MAX(NULLIF(e.user_id, ''))    AS user_id,
            MAX(NULLIF(e.user_email, '')) AS user_email,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
            COUNT(*) FILTER (WHERE e.severity = 'CRITICAL')::int AS critical,
            COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
            COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '7 days')::int AS last_7_days,
            COUNT(DISTINCT e.fingerprint)::int AS distinct_errors,
            array_agg(DISTINCT e.service_name) AS service_names,
            MIN(e.created_at) AS first_error_at,
            MAX(e.created_at) AS last_error_at,
            (array_agg(e.error_type    ORDER BY e.created_at DESC))[1] AS last_error_type,
            (array_agg(e.error_message ORDER BY e.created_at DESC))[1] AS last_error_message,
            (array_agg(e.endpoint      ORDER BY e.created_at DESC))[1] AS last_endpoint,
            (array_agg(e.service_name  ORDER BY e.created_at DESC))[1] AS last_service
     FROM error_logs e
     ${whereSql}
     GROUP BY 1
     ORDER BY ${userSortSql(sort)}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );
  return { rows, total };
}

/** Distinct issues (fingerprint groups), most frequent first. */
async function listIssues(docPool, { filters = {}, limit = 10 } = {}) {
  const { whereSql, values } = buildFilters(filters);
  const where = whereSql ? `${whereSql} AND e.fingerprint IS NOT NULL` : 'WHERE e.fingerprint IS NOT NULL';
  const { rows } = await docPool.query(
    `SELECT e.fingerprint,
            (array_agg(e.service_name  ORDER BY e.created_at DESC))[1] AS service_name,
            array_agg(DISTINCT e.service_name) AS service_names,
            (array_agg(e.source        ORDER BY e.created_at DESC))[1] AS source,
            (array_agg(e.category      ORDER BY e.created_at DESC))[1] AS category,
            (array_agg(e.severity      ORDER BY e.created_at DESC))[1] AS severity,
            (array_agg(e.error_type    ORDER BY e.created_at DESC))[1] AS error_type,
            (array_agg(e.error_message ORDER BY e.created_at DESC))[1] AS error_message,
            (array_agg(e.endpoint      ORDER BY e.created_at DESC))[1] AS endpoint,
            (array_agg(e.http_method   ORDER BY e.created_at DESC))[1] AS http_method,
            (array_agg(e.status_code   ORDER BY e.created_at DESC))[1] AS status_code,
            (array_agg(e.id            ORDER BY e.created_at DESC))[1] AS latest_id,
            COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
            COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
            COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS affected_users,
            MIN(e.created_at) AS first_seen,
            MAX(e.created_at) AS last_seen
     FROM error_logs e
     ${where}
     GROUP BY e.fingerprint
     ORDER BY count DESC, last_seen DESC
     LIMIT $${values.length + 1}`,
    [...values, limit]
  );
  return rows;
}

async function getStats(docPool) {
  const [totalsRes, trendRes, byService, byCategory, bySource, bySeverity, byStatus, byEnv, topEndpoints, issues, users, recent] =
    await Promise.all([
      docPool.query(`
        WITH ist AS (SELECT (NOW() AT TIME ZONE 'Asia/Kolkata') AS now_local)
        SELECT
          COUNT(*)::int                                                        AS total,
          COUNT(*) FILTER (WHERE NOT e.is_resolved)::int                       AS unresolved,
          COUNT(*) FILTER (WHERE e.is_resolved)::int                           AS resolved,
          COUNT(*) FILTER (WHERE e.severity = 'CRITICAL')::int                 AS critical,
          COUNT(*) FILTER (WHERE e.severity = 'ERROR')::int                    AS error,
          COUNT(*) FILTER (WHERE e.severity = 'WARNING')::int                  AS warning,
          COUNT(*) FILTER (WHERE e.severity = 'CRITICAL' AND NOT e.is_resolved)::int AS critical_unresolved,
          COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '1 hour')::int    AS last_hour,
          COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int  AS last_24h,
          COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE 'Asia/Kolkata')::date = ist.now_local::date)::int       AS today,
          COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE 'Asia/Kolkata')::date = ist.now_local::date - 1)::int   AS yesterday,
          COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ist.now_local::date - 6)::int  AS last_7_days,
          COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ist.now_local::date - 29)::int AS last_30_days,
          COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE 'Asia/Kolkata')::date >= date_trunc('month', ist.now_local)::date)::int AS this_month,
          COUNT(*) FILTER (WHERE ${HAS_USER_SQL})::int                         AS with_user,
          COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int  AS affected_users,
          COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL} AND e.created_at >= NOW() - INTERVAL '24 hours')::int AS affected_users_24h,
          COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL} AND NOT e.is_resolved)::int AS affected_users_unresolved,
          COUNT(DISTINCT e.fingerprint)::int                                   AS distinct_issues,
          COUNT(DISTINCT e.fingerprint) FILTER (WHERE NOT e.is_resolved)::int  AS distinct_issues_unresolved,
          COUNT(DISTINCT e.service_name)::int                                  AS services,
          COUNT(*) FILTER (WHERE e.source = 'EXTERNAL_API')::int               AS external_api,
          COUNT(*) FILTER (WHERE e.status_code >= 500)::int                    AS http_5xx,
          COUNT(*) FILTER (WHERE e.status_code BETWEEN 400 AND 499)::int       AS http_4xx,
          COUNT(*) FILTER (WHERE ${BROWSER_SQL})::int                          AS browser,
          COUNT(*) FILTER (WHERE ${RECOVERED_SQL})::int                        AS recovered,
          COUNT(*) FILTER (WHERE ${DEBUG_SQL})::int                            AS debug,
          ROUND(AVG(e.latency_ms))::int                                        AS avg_latency_ms,
          MAX(e.created_at)                                                    AS last_error_at,
          MAX(e.created_at) FILTER (WHERE e.severity = 'CRITICAL')             AS last_critical_at
        FROM error_logs e, ist
      `),

      docPool.query(`
        WITH days AS (
          SELECT generate_series(
                   (NOW() AT TIME ZONE 'Asia/Kolkata')::date - ${TREND_DAYS - 1},
                   (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
                   INTERVAL '1 day'
                 )::date AS day
        )
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
               to_char(d.day, 'DD Mon')     AS label,
               COUNT(e.id)::int                                               AS total,
               COUNT(e.id) FILTER (WHERE e.severity = 'CRITICAL')::int        AS critical,
               COUNT(e.id) FILTER (WHERE NOT e.is_resolved)::int              AS unresolved,
               COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS affected_users
        FROM days d
        LEFT JOIN error_logs e ON (e.created_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
        GROUP BY d.day ORDER BY d.day
      `),

      docPool.query(`
        SELECT e.service_name AS value, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
               COUNT(*) FILTER (WHERE e.severity = 'CRITICAL')::int AS critical,
               COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
               COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS affected_users,
               MAX(e.created_at) AS last_error_at
        FROM error_logs e GROUP BY 1 ORDER BY total DESC
      `),
      docPool.query(`
        SELECT e.category AS value, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
               COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h
        FROM error_logs e GROUP BY 1 ORDER BY total DESC
      `),
      docPool.query(`
        SELECT e.source AS value, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
               COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h
        FROM error_logs e GROUP BY 1 ORDER BY total DESC
      `),
      docPool.query(`
        SELECT e.severity AS value, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
               COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h
        FROM error_logs e GROUP BY 1
        ORDER BY array_position(ARRAY['CRITICAL','ERROR','WARNING']::text[], e.severity) NULLS LAST
      `),
      docPool.query(`
        SELECT e.status_code AS value, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved
        FROM error_logs e WHERE e.status_code IS NOT NULL GROUP BY 1 ORDER BY total DESC LIMIT 20
      `),
      docPool.query(`
        SELECT COALESCE(e.environment, 'unknown') AS value, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved
        FROM error_logs e GROUP BY 1 ORDER BY total DESC
      `),
      docPool.query(`
        SELECT e.service_name, e.http_method,
               ${ROUTE_SQL} AS route,
               MIN(e.endpoint) AS endpoint,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE NOT e.is_resolved)::int AS unresolved,
               COUNT(DISTINCT ${USER_KEY_SQL}) FILTER (WHERE ${HAS_USER_SQL})::int AS affected_users,
               MAX(e.created_at) AS last_error_at
        FROM error_logs e WHERE e.endpoint IS NOT NULL
        GROUP BY 1, 2, 3 ORDER BY total DESC LIMIT 10
      `),

      listIssues(docPool, { limit: 10 }),
      listUsers(docPool, { sort: 'most_errors', page: 1, limit: 10 }),

      docPool.query(
        `SELECT ${LIST_COLUMNS}, ${OCCURRENCE_SQL} FROM error_logs e
         WHERE NOT e.is_resolved ORDER BY e.created_at DESC LIMIT 5`
      ),
    ]);

  return {
    totals: totalsRes.rows[0],
    daily_trend: trendRes.rows,
    by_service: byService.rows,
    by_category: byCategory.rows,
    by_source: bySource.rows,
    by_severity: bySeverity.rows,
    by_status_code: byStatus.rows,
    by_environment: byEnv.rows,
    top_endpoints: topEndpoints.rows,
    top_issues: issues,
    top_users: users.rows,
    recent_unresolved: recent.rows,
  };
}

/** Distinct values that actually exist in the table (for filter dropdowns). */
async function getMeta(docPool) {
  const distinct = (col, { limit = 100, where = '' } = {}) =>
    docPool.query(
      `SELECT ${col} AS value, COUNT(*)::int AS count FROM error_logs e
       WHERE ${col} IS NOT NULL ${where} GROUP BY 1 ORDER BY count DESC, 1 LIMIT ${limit}`
    );
  const [services, environments, sources, categories, severities, errorTypes, providers, statusCodes, models] =
    await Promise.all([
      distinct('e.service_name'),
      distinct('e.environment'),
      distinct('e.source'),
      distinct('e.category'),
      distinct('e.severity'),
      distinct('e.error_type', { limit: 60 }),
      distinct('e.external_provider'),
      distinct('e.status_code', { limit: 40 }),
      distinct('e.external_model'),
    ]);
  return {
    services: services.rows,
    environments: environments.rows,
    sources: sources.rows,
    categories: categories.rows,
    severities: severities.rows,
    error_types: errorTypes.rows,
    providers: providers.rows,
    status_codes: statusCodes.rows,
    models: models.rows,
  };
}

// ── Auth-DB user enrichment ──────────────────────────────────────────────────

/**
 * Look up platform users by numeric id and/or email in the Auth DB.
 * Returns { byId: Map<string, user>, byEmail: Map<string, user> }. Never throws.
 */
async function lookupUsers(pool, { ids = [], emails = [] } = {}, logger = null) {
  const byId = new Map();
  const byEmail = new Map();
  if (!pool) return { byId, byEmail };

  const numericIds = [...new Set(ids.map((v) => String(v ?? '').trim()).filter((v) => /^\d{1,12}$/.test(v)).map(Number))];
  const lowerEmails = [...new Set(emails.map((v) => String(v ?? '').trim().toLowerCase()).filter((v) => v.includes('@')))];
  if (!numericIds.length && !lowerEmails.length) return { byId, byEmail };

  try {
    const { rows } = await pool.query(
      `SELECT id, email, username, role, account_type, approval_status, is_blocked, is_active,
              active_plan_name, last_seen_at, created_at
       FROM users
       WHERE id = ANY($1::int[]) OR LOWER(email) = ANY($2::text[])`,
      [numericIds, lowerEmails]
    );
    for (const r of rows) {
      const u = {
        id: r.id,
        email: r.email,
        username: r.username || null,
        role: r.role || null,
        account_type: r.account_type || null,
        approval_status: r.approval_status || null,
        is_blocked: Boolean(r.is_blocked),
        is_active: r.is_active !== false,
        active_plan_name: r.active_plan_name || null,
        last_seen_at: iso(r.last_seen_at),
        last_seen_at_ist: formatIST(r.last_seen_at),
        registered_at: iso(r.created_at),
      };
      byId.set(String(r.id), u);
      if (r.email) byEmail.set(String(r.email).toLowerCase(), u);
    }
  } catch (err) {
    if (logger) logger.warn('Error logs: user enrichment failed (Auth DB)', { summary: { message: err.message } });
  }
  return { byId, byEmail };
}

/**
 * Turn a `user` filter value (numeric id or email) into every identifier that user is known by,
 * so the SQL filter matches rows that recorded only the id or only the email.
 * Returns { ids: string[], emails: string[] (lower-cased), resolved: user|null }. Never throws.
 */
async function resolveUserFilter(pool, value, logger = null) {
  const v = String(value ?? '').trim();
  const ids = new Set();
  const emails = new Set();
  if (!v) return { ids: [], emails: [], resolved: null };

  const isEmail = v.includes('@');
  if (isEmail) emails.add(v.toLowerCase());
  else ids.add(v);

  const maps = await lookupUsers(pool, { ids: isEmail ? [] : [v], emails: isEmail ? [v] : [] }, logger);
  const u = isEmail ? maps.byEmail.get(v.toLowerCase()) : maps.byId.get(v);
  if (u) {
    ids.add(String(u.id));
    if (u.email) emails.add(String(u.email).toLowerCase());
  }
  return { ids: [...ids], emails: [...emails], resolved: u || null };
}

function resolveUserFor(row, maps) {
  if (!maps) return null;
  if (row.user_id && maps.byId.has(String(row.user_id))) return maps.byId.get(String(row.user_id));
  if (row.user_email && maps.byEmail.has(String(row.user_email).toLowerCase())) return maps.byEmail.get(String(row.user_email).toLowerCase());
  return null;
}

async function enrichRows(pool, rows, logger) {
  const maps = await lookupUsers(
    pool,
    { ids: rows.map((r) => r.user_id).filter(Boolean), emails: rows.map((r) => r.user_email).filter(Boolean) },
    logger
  );
  return maps;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Mark rows resolved / unresolved.
 * @param {object} target { ids: string[] } | { fingerprint: string }
 * @param {object} change { resolved: boolean, note: string|null, actor: string|null }
 */
async function setResolved(docPool, target, { resolved, note = null, actor = null }) {
  const values = [];
  const p = (v) => {
    values.push(v);
    return `$${values.length}`;
  };
  let whereSql;
  if (Array.isArray(target.ids) && target.ids.length) whereSql = `id = ANY(${p(target.ids)}::uuid[])`;
  else if (target.fingerprint) whereSql = `fingerprint = ${p(target.fingerprint)}`;
  else return { ids: [] };

  const setSql = resolved
    ? `is_resolved = true, resolved_by = ${p(actor)}, resolved_at = NOW(), resolution_note = ${p(note)}`
    : `is_resolved = false, resolved_by = NULL, resolved_at = NULL, resolution_note = NULL`;

  const { rows } = await docPool.query(
    `UPDATE error_logs SET ${setSql} WHERE ${whereSql} AND is_resolved <> ${p(Boolean(resolved))} RETURNING id`,
    values
  );
  return { ids: rows.map((r) => r.id) };
}

async function deleteLogs(docPool, target) {
  if (Array.isArray(target.ids) && target.ids.length) {
    const { rows } = await docPool.query(`DELETE FROM error_logs WHERE id = ANY($1::uuid[]) RETURNING id`, [target.ids]);
    return { ids: rows.map((r) => r.id) };
  }
  if (target.fingerprint) {
    const { rows } = await docPool.query(`DELETE FROM error_logs WHERE fingerprint = $1 RETURNING id`, [target.fingerprint]);
    return { ids: rows.map((r) => r.id) };
  }
  return { ids: [] };
}

module.exports = {
  // vocab
  SOURCES,
  SOURCE_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  STATUS_CLASSES,
  SORT_OPTIONS,
  USER_SORT_OPTIONS,
  TREND_DAYS,
  // serialise
  serializeLog,
  serializeUserGroup,
  serializeIssue,
  serializeAudit,
  // reads
  listLogs,
  getLogById,
  getRelated,
  getAuditForLog,
  listUsers,
  listIssues,
  getStats,
  getMeta,
  // enrichment
  lookupUsers,
  resolveUserFilter,
  resolveUserFor,
  enrichRows,
  // writes
  setResolved,
  deleteLogs,
};
