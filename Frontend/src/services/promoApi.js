import { API_BASE_URL, getToken } from '../config';

const ADMIN_BASE = `${API_BASE_URL}/admin/promos`;
const PUBLIC_BASE = `${API_BASE_URL}/public/promos`;

export class PromoApiError extends Error {
  constructor(message, { status, code, payload } = {}) {
    super(message);
    this.name = 'PromoApiError';
    this.status = status ?? null;
    this.code = code ?? null;
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
    throw new PromoApiError(message, { status: res.status, code: data?.error?.code, payload: data });
  }
  return data?.data ?? data;
};

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  const s = new URLSearchParams(clean.map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : '';
};

export const publicPromoApi = {
  getHeader: () => fetch(`${PUBLIC_BASE}/header`).then(handle),
  list: () => fetch(PUBLIC_BASE).then(handle),
  book: (id, body) =>
    fetch(`${PUBLIC_BASE}/${id}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(handle),
};

const promoApi = {
  getStats: () => fetch(`${ADMIN_BASE}/stats`, { headers: authHeaders(false) }).then(handle),
  list: (params) => fetch(`${ADMIN_BASE}${qs(params)}`, { headers: authHeaders(false) }).then(handle),
  get: (id) => fetch(`${ADMIN_BASE}/${id}`, { headers: authHeaders(false) }).then(handle),
  create: (body) => fetch(ADMIN_BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }).then(handle),
  update: (id, body) => fetch(`${ADMIN_BASE}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }).then(handle),
  setStatus: (id, status) =>
    fetch(`${ADMIN_BASE}/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) }).then(handle),
  remove: (id) => fetch(`${ADMIN_BASE}/${id}`, { method: 'DELETE', headers: authHeaders(false) }).then(handle),
};

export default promoApi;
