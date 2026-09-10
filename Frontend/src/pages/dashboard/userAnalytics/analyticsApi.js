import { API_BASE_URL, getAuthHeaders } from '../../../config';
import { createDebugLogger } from '../../../utils/debugLogger';

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
