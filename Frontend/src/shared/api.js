/**
 * Shared API access (blueprint: shared/api.js).
 * One import for the base URL, auth headers and a JSON fetch helper that applies the backend's
 * `{ success, data } | { success:false, message | error:{code,message} }` envelope. Feature API modules
 * (`features/<feature>/<feature>Api.js`) can build on this instead of re-implementing fetch + error parsing.
 */
import { API_BASE_URL, getAuthHeaders, getToken } from '../config/config';

export { API_BASE_URL, getAuthHeaders, getToken };

export class ApiError extends Error {
  constructor(message, { status, code, details, payload } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? null;
    this.code = code ?? null;
    this.details = details ?? null;
    this.payload = payload ?? null;
  }
}

/** `apiRequest('/admin/users-plans', { params: { page: 1 } })` → the `data` part of the envelope (or the body). */
export async function apiRequest(path, { method = 'GET', params, body, headers = {} } = {}) {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, window.location.origin);
  Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.set(k, String(v)); });
  const res = await fetch(url.toString(), {
    method,
    headers: { ...getAuthHeaders(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok || payload?.success === false) {
    const err = payload?.error && typeof payload.error === 'object' ? payload.error : null;
    throw new ApiError(err?.message || payload?.message || (typeof payload?.error === 'string' ? payload.error : null) || `HTTP ${res.status}`, {
      status: res.status, code: err?.code || payload?.code || null, details: err?.details || null, payload,
    });
  }
  return payload?.data ?? payload;
}
