// Sales Referrals service — the ONLY module UI components import for data.
// Backend: docs/sales-referrals-admin-api.md (section 9 is authoritative):
//   base    `${API_BASE_URL}/admin/sales-referrals`
//   success `{ success: true, data }`   error `{ success: false, error: { code, message, details } }`
//   paging  0-based `page`, `size` (1–100)

import { API_BASE_URL, getToken } from '../../../config';
import { createDebugLogger } from '../../../utils/debugLogger';

const log = createDebugLogger('SalesReferralsApi');
const BASE = `${API_BASE_URL}/admin/sales-referrals`;

export const SALES_REFERRALS_ENDPOINTS = Object.freeze({
  owners: `${BASE}/owners`,                                                            // A1 POST, A13 is under /reports
  owner: (ownerId) => `${BASE}/owners/${encodeURIComponent(ownerId)}`,               // A2 PUT, A3 GET
  ownerCodes: (ownerId) => `${BASE}/owners/${encodeURIComponent(ownerId)}/codes`,    // A4 POST
  code: (codeId) => `${BASE}/codes/${encodeURIComponent(codeId)}`,                   // A5 PATCH
  deactivate: (codeId) => `${BASE}/codes/${encodeURIComponent(codeId)}/deactivate`,  // A6
  activate: (codeId) => `${BASE}/codes/${encodeURIComponent(codeId)}/activate`,      // A7
  refresh: (codeId) => `${BASE}/codes/${encodeURIComponent(codeId)}/refresh`,        // A8
  suggest: `${BASE}/codes/suggest`,                                                  // A9
  availability: `${BASE}/codes/availability`,                                        // A10
  codes: `${BASE}/codes`,                                                            // A11
  summary: `${BASE}/reports/summary`,                                                // A12
  ownersReport: `${BASE}/reports/owners`,                                            // A13
  ownerCodesReport: (ownerId) => `${BASE}/reports/owners/${encodeURIComponent(ownerId)}/codes`, // A14
  signups: `${BASE}/reports/signups`,                                                // A15
  tenantReferral: (tenantId) => `${BASE}/tenants/${encodeURIComponent(tenantId)}/referral`, // A16 PUT, A17 GET
  userReferral: (userId) => `${BASE}/users/${encodeURIComponent(userId)}/referral`,  // A17 GET (via user)
  // Signup-side public check; lives in the signup auth service, not in this backend (doc §9.4).
  publicCheck: `${API_BASE_URL}/public/referral-codes/check`,
});

export class SalesReferralsApiError extends Error {
  constructor(message, { status, code, details, payload, requestId } = {}) {
    super(message);
    this.name = 'SalesReferralsApiError';
    this.status = status ?? null;
    this.code = code ?? null;
    this.details = details ?? null;
    this.payload = payload ?? null;
    this.requestId = requestId ?? null;
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
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const err = body?.error && typeof body.error === 'object' ? body.error : null;
    const message = err?.message || body?.message || (typeof body?.error === 'string' ? body.error : null) || `HTTP ${res.status}`;
    throw new SalesReferralsApiError(message, {
      status: res.status, code: err?.code || body?.errorCode || null, details: err?.details || body?.details || null,
      payload: body, requestId: body?.requestId,
    });
  }
  return body?.data ?? body;
};

/** Drops empty params; arrays become comma-separated; `dateRange` expands to from/to. */
export const qs = (params = {}) => {
  const flat = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (k === 'dateRange') {
      if (v.from) flat.from = v.from;
      if (v.to) flat.to = v.to;
      return;
    }
    flat[k] = Array.isArray(v) ? v.filter(Boolean).join(',') : String(v);
  });
  const s = new URLSearchParams(flat).toString();
  return s ? `?${s}` : '';
};

const request = async (url, { method = 'GET', body } = {}) => {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(body !== undefined),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await handle(res);
    log.event('request:ok', { method, url, status: res.status, ms: Date.now() - startedAt });
    return data;
  } catch (err) {
    log.flow('request:failed', { level: 'error', summary: { method, url, status: err.status, code: err.code, ms: Date.now() - startedAt }, error: err });
    throw err;
  }
};
const get = (url) => request(url);
const post = (url, body = {}) => request(url, { method: 'POST', body });
// Shared with services/referralData.api.js so both services use one auth/error path.
export { get as httpGet, post as httpPost, handle as parseResponse };
const put = (url, body) => request(url, { method: 'PUT', body });
const patch = (url, body) => request(url, { method: 'PATCH', body });

const E = SALES_REFERRALS_ENDPOINTS;

// ── Owners (A1–A3) ────────────────────────────────────────────────────────────
/** A1 → owner with its codes. */
export const createOwner = ({ name, internal, notes, codes }) =>
  post(E.owners, { name, internal: Boolean(internal), notes: notes || null, codes });

/** A2 → owner (A3 shape). */
export const updateOwner = (ownerId, { name, internal, notes }) =>
  put(E.owner(ownerId), { name, internal: Boolean(internal), notes: notes || null });

/** A3 → owner profile with all codes and `codeCounts`. */
export const getOwner = (ownerId) => get(E.owner(ownerId));

// ── Codes (A4–A11) ────────────────────────────────────────────────────────────
/** A4 → code object. */
export const addCode = (ownerId, { code, label }) => post(E.ownerCodes(ownerId), { code, label: label || null });
/** A5 → code object. */
export const updateCodeLabel = (codeId, label) => patch(E.code(codeId), { label: label || null });
/** A6 → code object (`active: false`). */
export const deactivateCode = (codeId) => post(E.deactivate(codeId));
/** A7 → code object (`active: true`); 409 REFERRAL_CODE_REPLACED for refreshed codes. */
export const activateCode = (codeId) => post(E.activate(codeId));
/** A8 → `{ oldCode, newCode }`. */
export const refreshCode = (codeId) => post(E.refresh(codeId));

/**
 * A9 → one available suggestion. Pass either `{ ownerName }` or `{ ownerId }`.
 * @returns {Promise<string>}
 */
export const suggestCode = ({ ownerName, ownerId }, excludeCodes = []) =>
  get(`${E.suggest}${qs({ ownerName: ownerId ? undefined : ownerName, ownerId, count: 1, exclude: excludeCodes })}`)
    .then((d) => (d?.suggestions || [])[0] || '');

/** A10 → `{ code, status: 'AVAILABLE' | 'TAKEN' | 'INVALID_FORMAT' }`. */
export const checkCodeAvailable = (code) => get(`${E.availability}${qs({ code })}`);

/** A11 → `[{ owner, codes }]` for the picker (inactive included). */
export const listCodes = (search = '', { includeInactive = true, limit = 50 } = {}) =>
  get(`${E.codes}${qs({ search, includeInactive, limit })}`).then((d) => d?.groups || []);

// ── Reports (A12–A15) ─────────────────────────────────────────────────────────
/** A12. filters: { dateRange, type } */
export const getSummary = ({ dateRange, type } = {}) => get(`${E.summary}${qs({ dateRange, type })}`);

/** A13. filters: { dateRange, type, search, sort, direction } → { ownerCountAll, owners, direct } */
export const getOwnersReport = ({ dateRange, type, search, sort, direction } = {}) =>
  get(`${E.ownersReport}${qs({ dateRange, type, search, sort, direction })}`);

/** A14 → { owner, totals, codes } */
export const getOwnerCodesReport = (ownerId, { dateRange } = {}) =>
  get(`${E.ownerCodesReport(ownerId)}${qs({ dateRange })}`);

/**
 * A15. Exactly one of codeId / ownerId / direct. `page` is 1-based here and converted to the
 * API's 0-based page; the result's `page` is converted back.
 */
export const getSignups = ({ codeId, ownerId, direct, status, search, dateRange, page = 1, pageSize = 20 } = {}) =>
  get(`${E.signups}${qs({
    codeId, ownerId, direct: direct ? 'true' : undefined,
    status: status && status !== 'ALL' ? status : undefined,
    search, dateRange, page: Math.max(0, page - 1), size: pageSize,
  })}`).then((d) => ({ ...d, page: (d?.page ?? 0) + 1, items: d?.items || [] }));

// ── Workspace referral (A16–A17) ──────────────────────────────────────────────
/** A17 by workspace → { tenantId, firmName, referral } */
export const getTenantReferral = (tenantId) => get(E.tenantReferral(tenantId));
/** A17 by user (resolves the user's workspace) → { tenantId, firmName, referral } */
export const getUserReferral = (userId) => get(E.userReferral(userId));
/** A16 → referral block (+ `previous`). */
export const setTenantReferral = (tenantId, { codeId, reason }) => put(E.tenantReferral(tenantId), { codeId, reason });

// ── Signup-side public check (not in this backend yet, doc §9.4) ─────────────
/** → 'VALID' | 'INVALID' | 'INACTIVE' */
export const checkReferralCode = (code) =>
  fetch(`${E.publicCheck}${qs({ code })}`).then(handle).then((d) => d?.status ?? d);

const salesReferralsApi = {
  createOwner, updateOwner, getOwner, addCode, updateCodeLabel, deactivateCode, activateCode, refreshCode,
  suggestCode, checkCodeAvailable, listCodes, getSummary, getOwnersReport, getOwnerCodesReport, getSignups,
  getTenantReferral, getUserReferral, setTenantReferral, checkReferralCode,
};
export default salesReferralsApi;
