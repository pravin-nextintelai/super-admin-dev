import { API_BASE_URL, getToken } from '../config';

// Activity & Error Logs → one row per API call across all services (api_audit_logs),
// with the linked error_logs row for failed calls.
// Backend: /api/admin/audit-logs (see docs/ERROR_LOGS_API.md §7). Read-only.
const BASE = `${API_BASE_URL}/admin/audit-logs`;

export class AuditLogApiError extends Error {
  constructor(message, { status, code, details, payload } = {}) {
    super(message);
    this.name = 'AuditLogApiError';
    this.status = status ?? null;
    this.code = code ?? null;
    this.details = Array.isArray(details) ? details : [];
    this.payload = payload ?? null;
  }
}

const authHeaders = (json = true) => {
  const token = getToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handle = async (res) => {
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    const message =
      data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : null) || `HTTP ${res.status}`;
    throw new AuditLogApiError(message, {
      status: res.status,
      code: data?.error?.code,
      details: data?.error?.details,
      payload: data,
    });
  }
  return data?.data ?? data;
};

/** Drops empty params; arrays become comma-separated lists. */
const qs = (params = {}) => {
  const clean = Object.entries(params)
    .map(([k, v]) => [k, Array.isArray(v) ? v.filter(Boolean).join(',') : v])
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  const s = new URLSearchParams(clean.map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : '';
};

const auditLogApi = {
  /** params: from, to (YYYY-MM-DD IST), user, service, status, kind, exclude_pings, q */
  getSummary: (params) => fetch(`${BASE}/summary${qs(params)}`, { headers: authHeaders(false) }).then(handle),

  getMeta: () => fetch(`${BASE}/meta`, { headers: authHeaders(false) }).then(handle),

  /**
   * params: page, page_size, from, to, user, service, status, method, endpoint, route,
   * resource_type, action, request_id, q, exclude_pings, kind, sort
   * → { rows, total, page, page_size, total_pages, filters }
   */
  list: (params) => fetch(`${BASE}${qs(params)}`, { headers: authHeaders(false) }).then(handle),

  /** → { audit (full row incl. stack_trace), error (linked error_logs row | null), errors[] } */
  get: (id) => fetch(`${BASE}/${encodeURIComponent(id)}`, { headers: authHeaders(false) }).then(handle),

  /** Server-side CSV (IST columns), same filters as list(). Resolves { blob, fileName, totalRows, exportedRows }. */
  exportCsv: async (params) => {
    const res = await fetch(`${BASE}/export${qs({ ...params, page: undefined, page_size: undefined })}`, {
      headers: authHeaders(false),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new AuditLogApiError(data?.error?.message || `HTTP ${res.status}`, {
        status: res.status,
        code: data?.error?.code,
        details: data?.error?.details,
        payload: data,
      });
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: await res.blob(),
      fileName: match?.[1] || `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      totalRows: Number(res.headers.get('x-total-rows') || 0),
      exportedRows: Number(res.headers.get('x-exported-rows') || 0),
    };
  },
};

export default auditLogApi;
