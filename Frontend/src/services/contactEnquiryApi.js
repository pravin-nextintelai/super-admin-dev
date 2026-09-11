import { API_BASE_URL, getToken } from '../config';

// Marketing → Contact Enquiries ("Contact Jurinex" website form).
// Backend: /api/admin/contact-enquiries (see Backend/documentation.md → H).
const BASE = `${API_BASE_URL}/admin/contact-enquiries`;

export class ContactEnquiryApiError extends Error {
  constructor(message, { status, code, details, payload } = {}) {
    super(message);
    this.name = 'ContactEnquiryApiError';
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
    throw new ContactEnquiryApiError(message, {
      status: res.status,
      code: data?.error?.code,
      details: data?.error?.details,
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

const contactEnquiryApi = {
  getStats: () => fetch(`${BASE}/stats`, { headers: authHeaders(false) }).then(handle),

  getMeta: () => fetch(`${BASE}/meta`, { headers: authHeaders(false) }).then(handle),

  /** params: page, limit, status, topic, priority, consent, assigned, search, from, to, sort */
  list: (params) => fetch(`${BASE}${qs(params)}`, { headers: authHeaders(false) }).then(handle),

  get: (id) => fetch(`${BASE}/${id}`, { headers: authHeaders(false) }).then(handle),

  /** body: { status?, priority?, assigned_to?, note? } */
  update: (id, body) =>
    fetch(`${BASE}/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) }).then(handle),

  /** body: { channel, outcome?, note?, contacted_at?, set_status? } */
  logContact: (id, body) =>
    fetch(`${BASE}/${id}/contact-log`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }).then(handle),

  addNote: (id, note) =>
    fetch(`${BASE}/${id}/notes`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ note }) }).then(handle),

  remove: (id) => fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(false) }).then(handle),

  /** Server-side CSV (IST columns). Resolves { blob, fileName, totalRows, exportedRows }. */
  exportCsv: async (params) => {
    const res = await fetch(`${BASE}/export${qs(params)}`, { headers: authHeaders(false) });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ContactEnquiryApiError(data?.error?.message || `HTTP ${res.status}`, { status: res.status, payload: data });
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: await res.blob(),
      fileName: match?.[1] || `contact-enquiries-${new Date().toISOString().slice(0, 10)}.csv`,
      totalRows: Number(res.headers.get('x-total-rows') || 0),
      exportedRows: Number(res.headers.get('x-exported-rows') || 0),
    };
  },
};

export default contactEnquiryApi;
