import { API_BASE_URL, getToken } from '../config';

const BASE = `${API_BASE_URL}/admin/newsletter-subscribers`;

export class NewsletterSubscriberApiError extends Error {
  constructor(message, { status, code, payload } = {}) {
    super(message);
    this.name = 'NewsletterSubscriberApiError';
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
    throw new NewsletterSubscriberApiError(message, {
      status: res.status,
      code: data?.error?.code,
      payload: data,
    });
  }
  return data?.data ?? data;
};

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  const s = new URLSearchParams(clean.map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : '';
};

const newsletterSubscriberApi = {
  getStats: () => fetch(`${BASE}/stats`, { headers: authHeaders(false) }).then(handle),

  /** params: page, limit, search, device_type, source, from, to, sort */
  list: (params) => fetch(`${BASE}${qs(params)}`, { headers: authHeaders(false) }).then(handle),

  get: (id) => fetch(`${BASE}/${id}`, { headers: authHeaders(false) }).then(handle),

  exportCsv: async (params) => {
    const res = await fetch(`${BASE}/export${qs(params)}`, { headers: authHeaders(false) });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new NewsletterSubscriberApiError(data?.error?.message || `HTTP ${res.status}`, { status: res.status, payload: data });
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: await res.blob(),
      fileName: match?.[1] || `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
      totalRows: Number(res.headers.get('x-total-rows') || 0),
      exportedRows: Number(res.headers.get('x-exported-rows') || 0),
    };
  },
};

export default newsletterSubscriberApi;
