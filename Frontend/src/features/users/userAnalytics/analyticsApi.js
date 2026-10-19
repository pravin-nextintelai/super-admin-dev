import { API_BASE_URL, getAuthHeaders } from '../../../config/config';
import { createDebugLogger } from '../../../shared/utils/debugLogger';

const analyticsApiLogger = createDebugLogger('AnalyticsApi');

const BASE = `${API_BASE_URL}/admin/user-analytics`;

async function req(url) {
  const startedAt = Date.now();
  analyticsApiLogger.event('request:start', { url });
  const res = await fetch(url, { headers: getAuthHeaders() });
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    analyticsApiLogger.flow('request:failed', {
      level: 'error',
      summary: { url, status: res.status },
      output: body,
      metrics: { durationMs: Date.now() - startedAt },
    });
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  analyticsApiLogger.event('request:success', {
    url,
    status: res.status,
    durationMs: Date.now() - startedAt,
  });
  return body;
}

export const fetchUserAnalytics = (userId) => req(`${BASE}/users/${userId}/analytics`);
export const fetchUserStorage = (userId) => req(`${BASE}/users/${userId}/storage`);
export const fetchUserTokenSeries = (userId, days = 30) => req(`${BASE}/users/${userId}/token-usage?days=${days}`);
export const fetchUserAiUsage = (userId, days = 30) => req(`${BASE}/users/${userId}/ai-usage?days=${days}`);
export const fetchFirmAnalytics = (firmId) => req(`${BASE}/firms/${firmId}/analytics`);

const PBASE = `${API_BASE_URL}/admin/plan-analytics`;
export const fetchPlanSummary = () => req(`${PBASE}/summary`);
export const fetchMonthlySubscribers = (planId) => req(`${PBASE}/monthly/${planId}/subscribers`);
export const fetchTopupBuyers = (planId) => req(`${PBASE}/topup/${planId}/buyers`);
export const fetchAddonBuyers = (planId) => req(`${PBASE}/addon/${planId}/buyers`);

export const fetchSubscriberInvoices = (userId) => req(`${PBASE}/subscribers/${userId}/invoices`);


/** Download a plan payment's invoice or receipt PDF. doc: 'invoice' | 'receipt'. */
export const downloadSubscriberDocument = async (userId, paymentId, doc) => {
  const url = `${PBASE}/subscribers/${userId}/payments/${paymentId}/${doc}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* non-JSON */ }
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const match = /filename="?([^"]+)"?/i.exec(res.headers.get('content-disposition') || '');
  return { blob, filename: match?.[1] || `${doc}-${paymentId}.pdf` };
};

export const fetchPlanSubscribers = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    q.set(key, String(value));
  });
  const qs = q.toString();
  return req(`${PBASE}/subscribers${qs ? `?${qs}` : ''}`);
};

export const downloadPlanSubscribersCsv = async (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    q.set(key, String(value));
  });
  const qs = q.toString();
  const url = `${PBASE}/subscribers/export${qs ? `?${qs}` : ''}`;
  const startedAt = Date.now();
  analyticsApiLogger.event('csv:start', { url });
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* non-JSON */ }
    analyticsApiLogger.flow('csv:failed', {
      level: 'error',
      summary: { url, status: res.status },
      output: body,
      metrics: { durationMs: Date.now() - startedAt },
    });
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const match = /filename="?([^"]+)"?/i.exec(res.headers.get('content-disposition') || '');
  analyticsApiLogger.event('csv:success', { url, status: res.status, durationMs: Date.now() - startedAt });
  return { blob, filename: match?.[1] || `users-plans-${new Date().toISOString().slice(0, 10)}.csv` };
};

// ── Shared request helpers (JSON / blob, any method) ─────────────────────────
const toQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    q.set(key, String(value));
  });
  const qs = q.toString();
  return qs ? `?${qs}` : '';
};

/** JSON request. Throws Error with `.status` and `.code` (e.g. NO_INVOICE) on non-2xx. */
async function reqJson(url, { method = 'GET', body } = {}) {
  const startedAt = Date.now();
  analyticsApiLogger.event('request:start', { url, method });
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let payload = {};
  try { payload = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    analyticsApiLogger.flow('request:failed', {
      level: 'error',
      summary: { url, method, status: res.status, code: payload.code },
      output: payload,
      metrics: { durationMs: Date.now() - startedAt },
    });
    const err = new Error(payload.message || payload.error?.message || payload.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = payload.code || payload.error?.code || null;
    throw err;
  }
  analyticsApiLogger.event('request:success', { url, method, status: res.status, durationMs: Date.now() - startedAt });
  return payload;
}

/** Binary download. Resolves { blob, filename } (filename from Content-Disposition). */
async function reqBlob(url, fallbackName) {
  const startedAt = Date.now();
  analyticsApiLogger.event('download:start', { url });
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch { /* non-JSON */ }
    analyticsApiLogger.flow('download:failed', {
      level: 'error',
      summary: { url, status: res.status, code: payload.code },
      output: payload,
      metrics: { durationMs: Date.now() - startedAt },
    });
    const err = new Error(payload.message || payload.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = payload.code || null;
    throw err;
  }
  const blob = await res.blob();
  const match = /filename\*?="?([^";]+)"?/i.exec(res.headers.get('content-disposition') || '');
  analyticsApiLogger.event('download:success', { url, status: res.status, durationMs: Date.now() - startedAt });
  return { blob, filename: match?.[1] || fallbackName };
}

// ── Users & Plans — /api/admin/users-plans ───────────────────────────────────
const UPBASE = `${API_BASE_URL}/admin/users-plans`;

/**
 * Paginated users (view=users) or paid plan payments (view=transactions).
 * Params: page, pageSize, search, plan, topupPlanId, ownerType, ownerId, code, userStatus,
 * from, to (IST, inclusive), sortBy, sortDir, view.
 */
export const fetchUsersPlans = (params = {}) => reqJson(`${UPBASE}${toQuery(params)}`);
export const fetchUsersPlansFilters = () => reqJson(`${UPBASE}/filters`);
export const fetchUsersPlanDetail = (userId) => reqJson(`${UPBASE}/${encodeURIComponent(userId)}`);
export const fetchUsersPlanTransactions = (userId) => reqJson(`${UPBASE}/${encodeURIComponent(userId)}/transactions`);
export const downloadUsersPlansCsv = (params = {}) =>
  reqBlob(`${UPBASE}/export${toQuery(params)}`, `users-plans-${new Date().toISOString().slice(0, 10)}.csv`);
/** doc: 'invoice' (404 code NO_INVOICE when no app invoice exists) | 'receipt' (always for paid rows). */
export const downloadUsersPlanDocument = (userId, paymentId, doc) =>
  reqBlob(`${UPBASE}/${encodeURIComponent(userId)}/payments/${encodeURIComponent(paymentId)}/${doc}`, `${doc}-${paymentId}.pdf`);

// ── Razorpay reconciliation — /api/admin/reconciliation ─────────────────────
const RBASE = `${API_BASE_URL}/admin/reconciliation`;

/** { startDate, endDate } YYYY-MM-DD (IST, inclusive, ≤ 92 days, not future). 202 → run. */
export const createReconciliationRun = (body) => reqJson(`${RBASE}/runs`, { method: 'POST', body });
export const fetchReconciliationRuns = (params = {}) => reqJson(`${RBASE}/runs${toQuery(params)}`);
export const fetchReconciliationRun = (runId) => reqJson(`${RBASE}/runs/${encodeURIComponent(runId)}`);
export const fetchReconciliationIssues = (runId, params = {}) => reqJson(`${RBASE}/runs/${encodeURIComponent(runId)}/issues${toQuery(params)}`);
export const downloadReconciliationIssuesCsv = (runId) =>
  reqBlob(`${RBASE}/runs/${encodeURIComponent(runId)}/export`, `reconciliation-run-${runId}.csv`);
export const retryReconciliationRun = (runId) => reqJson(`${RBASE}/runs/${encodeURIComponent(runId)}/retry`, { method: 'POST' });
export const fetchReconciliationIssue = (issueId) => reqJson(`${RBASE}/issues/${encodeURIComponent(issueId)}`);
export const fetchReconciliationIssueHistory = (issueId) => reqJson(`${RBASE}/issues/${encodeURIComponent(issueId)}/history`);
export const resolveReconciliationIssue = (issueId, reason) =>
  reqJson(`${RBASE}/issues/${encodeURIComponent(issueId)}/resolve`, { method: 'PATCH', body: { reason } });
export const reopenReconciliationIssue = (issueId, reason) =>
  reqJson(`${RBASE}/issues/${encodeURIComponent(issueId)}/reopen`, { method: 'PATCH', body: reason ? { reason } : {} });
/** Side-by-side DB ↔ Razorpay comparison of a run. Params: status, search, page, pageSize. */
export const fetchReconciliationComparison = (runId, params = {}) =>
  reqJson(`${RBASE}/runs/${encodeURIComponent(runId)}/comparison${toQuery(params)}`);
export const downloadReconciliationComparisonCsv = (runId) =>
  reqBlob(`${RBASE}/runs/${encodeURIComponent(runId)}/comparison/export`, `reconciliation-comparison-run-${runId}.csv`);
