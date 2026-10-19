// "All referral data" service — the ONLY module the page imports for data.
// Backend: docs/ONBOARDED_USERS_API.md
//   base    `${API_BASE_URL}/admin/onboarded-users`
//   success `{ success: true, data }`   error `{ success: false, error: { code, message, details } }`
//   paging  1-based `page`, `limit` (max 200); filters are comma-separated lists.
// Every function maps the backend's snake_case objects to the camelCase shapes in
// types/referralData.types.js so the components never see raw API payloads.

import { API_BASE_URL, getToken } from '../../config/config';
import { SalesReferralsApiError, httpGet, parseResponse, qs } from './referralApi';
import { buildCsv, csvBlob } from './utils/csv';
import { USER_HISTORY_CSV_COLUMNS, userHistoryFileName } from './utils/referralData.utils';
import { CHANNEL, EVENT_TYPE, EXPORT_KIND, EXPORT_SCOPE, PLAN_STATUS_FILTER, REFERRAL_DATA_PAGE_SIZE } from './types/referralData.types';
import { todayYmd } from './utils/salesReferrals.utils';
import { createDebugLogger } from '../../shared/utils/debugLogger';

const log = createDebugLogger('ReferralDataApi');
const BASE = `${API_BASE_URL}/admin/onboarded-users`;

export const ONBOARDED_USERS_ENDPOINTS = Object.freeze({
  list: BASE,                                                   // GET  paginated users
  summary: `${BASE}/summary`,                                   // GET  totals by channel / owner / plan
  meta: `${BASE}/meta`,                                         // GET  owners, codes, plans for the filters
  export: `${BASE}/export`,                                     // GET  CSV (mode=users | history)
  user: (userId) => `${BASE}/${encodeURIComponent(userId)}`,    // GET  one user + complete subscription history
});
const E = ONBOARDED_USERS_ENDPOINTS;

/** @typedef {import('./types/referralData.types').ReferralDataFilters} ReferralDataFilters */

// ── Query params ──────────────────────────────────────────────────────────────
/** Owner type + "Include Direct" → the API's `channel` list (SELF = direct). */
const channelParam = (f) => {
  if (f.ownerType === 'INTERNAL') return 'internal';
  if (f.ownerType === 'OUTSOURCED') return 'outsourced';
  return f.includeDirect === false ? 'internal,outsourced' : undefined;
};

/** @param {Partial<ReferralDataFilters>} f */
export const filterParams = (f = {}, { paged = true, withStatus = true } = {}) => ({
  dateRange: f.dateRange,                                        // → from / to (IST days on users.created_at)
  owner_id: f.ownerId || undefined,
  code: f.code || undefined,
  channel: channelParam(f),
  plan_status: withStatus && f.planStatus && f.planStatus !== PLAN_STATUS_FILTER.ALL ? f.planStatus : undefined,
  search: f.search?.trim() || undefined,
  sort: 'newest',
  ...(paged ? { page: f.page || 1, limit: f.pageSize || REFERRAL_DATA_PAGE_SIZE } : {}),
});

// ── Mapping ───────────────────────────────────────────────────────────────────
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const ownerTypeOf = (owner) => (owner ? (owner.internal ? 'INTERNAL' : 'OUTSOURCED') : null);

/** List / detail `user` object → ReferralUserRow. */
export const toUserRow = (u) => {
  const o = u.onboarding || {};
  const p = u.plan || {};
  const cs = p.current_subscription || null;
  const s = u.subscription_summary || {};
  const ws = u.workspace || null;
  return {
    userId: u.id,
    userEmail: u.email,
    userName: u.username || u.email,
    phone: u.phone || null,
    accountType: u.account_type || null,
    domainRole: u.domain_role || null,
    approvalStatus: u.approval_status || null,
    isActive: u.is_active !== false && !u.is_blocked,
    isBlocked: Boolean(u.is_blocked),
    workspace: ws ? { id: ws.id, name: ws.name, type: ws.type || null, role: ws.member_role || null, city: ws.city || null, state: ws.state || null } : null,
    organisation: u.profile?.organization_name || null,
    firmName: ws?.name || u.profile?.organization_name || null,
    channel: o.channel || CHANNEL.SELF,
    channelLabel: o.channel_label || '',
    ownerId: o.sales_owner?.id || null,
    ownerName: o.sales_owner?.name || null,
    ownerType: ownerTypeOf(o.sales_owner),
    code: o.referral_code || null,
    codeLabel: o.referral_label || null,
    codeActive: o.referral_code_active ?? null,
    referralLevel: o.level || null,
    attribution: o.source || null,
    attributionSetAt: o.set_at || null,
    attributionReason: o.reason || null,
    signedUpAt: u.created_at,
    lastLoginAt: u.last_login_at || null,
    planStatus: p.status || 'FREE',
    activePlanName: p.active_plan_name || null,
    currentPlanName: p.active_plan_name || cs?.plan_name || null,
    currentSubscription: cs ? {
      planName: cs.plan_name || null, status: cs.status || null, startDate: cs.start_date || null, endDate: cs.end_date || null,
      isExpired: cs.is_expired ?? null, price: cs.plan_price ?? null, intervalMonths: cs.billing_interval_months ?? null,
    } : null,
    subscriptions: num(s.subscriptions),
    planNames: s.plan_names || [],
    purchaseCount: num(s.captured_payments),
    topupCount: num(s.completed_topups),
    storageAddonCount: num(s.completed_storage_addons),
    totalPaidInr: num(s.total_paid),
    subscriptionPaid: num(s.subscription_paid),
    topupPaid: num(s.topup_paid),
    storagePaid: num(s.storage_paid),
    firstPurchaseAt: s.first_payment_at || null,
    lastPurchaseAt: s.last_payment_at || null,
    lastPaymentAmount: s.last_payment_amount ?? null,
  };
};

const toEvent = (e, i) => ({
  id: `${e.type}-${e.ref_id ?? 'x'}-${e.at}-${i}`,
  type: e.type,
  occurredAt: e.at,
  title: e.title,
  detail: e.detail || null,
  amountInr: e.amount === null || e.amount === undefined ? null : Number(e.amount),
  currency: e.currency || null,
  status: e.status || null,
  refId: e.ref_id ?? null,
});

const toSummary = (d) => {
  const t = d.totals || {};
  const ch = Object.fromEntries((d.by_channel || []).map((b) => [b.channel, b]));
  return {
    users: num(t.users),
    viaCode: num(ch.INTERNAL?.users) + num(ch.OUTSOURCED?.users),
    direct: num(ch.SELF?.users),
    paidNow: num(t.paid),
    free: num(t.free),
    lapsed: num(t.lapsed),
    withWorkspace: num(t.with_workspace),
    payments: num(t.payments),
    totalPaidInr: num(t.total_paid),
    subscriptionPaid: num(t.subscription_paid),
    topupPaid: num(t.topup_paid),
    storagePaid: num(t.storage_paid),
    paidRatePct: num(t.paid_rate_pct),
    truncated: Boolean(d.truncated),
  };
};

const toPage = (d, mapItem) => {
  const pg = d.pagination || {};
  return {
    items: (d.users || []).map(mapItem),
    page: num(pg.page) || 1,
    size: num(pg.limit) || REFERRAL_DATA_PAGE_SIZE,
    totalItems: num(pg.total),
    totalPages: Math.max(1, num(pg.totalPages) || 1),
    truncated: Boolean(d.truncated),
  };
};

// ── GET /meta → owners + codes for the filter selects ─────────────────────────
/** @returns {Promise<import('./types/referralData.types').ReferralDataOwner[]>} */
export const getReferralDataOwners = () =>
  httpGet(E.meta).then((m) => {
    const codesByOwner = new Map();
    (m.referral_codes || []).forEach((c) => {
      if (!codesByOwner.has(c.owner_id)) codesByOwner.set(c.owner_id, []);
      codesByOwner.get(c.owner_id).push({ id: c.id, code: c.code, label: c.label || null, active: Boolean(c.active) });
    });
    return (m.sales_owners || []).map((o) => ({ id: o.id, name: o.name, internal: Boolean(o.internal), codes: codesByOwner.get(o.id) || [] }));
  });

// ── GET /summary → the 5 cards (status filter included) ───────────────────────
/** @param {ReferralDataFilters} filters @returns {Promise<import('./types/referralData.types').ReferralDataSummary>} */
export const getReferralDataSummary = (filters) =>
  httpGet(`${E.summary}${qs(filterParams(filters, { paged: false }))}`).then(toSummary);

// ── GET /summary without plan_status → counts for the status pills ────────────
/** @param {ReferralDataFilters} filters @returns {Promise<import('./types/referralData.types').StatusCounts>} */
export const getReferralDataStatusCounts = (filters) =>
  httpGet(`${E.summary}${qs(filterParams(filters, { paged: false, withStatus: false }))}`)
    .then((d) => ({ all: num(d.totals?.users), free: num(d.totals?.free), paid: num(d.totals?.paid), lapsed: num(d.totals?.lapsed) }));

// ── GET / → paginated users ───────────────────────────────────────────────────
/** @param {ReferralDataFilters} filters @returns {Promise<import('./types/referralData.types').ReferralUsersPage>} */
export const getReferralUsers = (filters) =>
  httpGet(`${E.list}${qs(filterParams(filters))}`).then((d) => toPage(d, toUserRow));

// ── GET /:userId → complete subscription history + timeline ───────────────────
/** @returns {Promise<import('./types/referralData.types').UserHistory>} */
export const getUserHistory = (userId) =>
  httpGet(E.user(userId)).then((d) => ({
    userId: Number(userId),
    user: toUserRow(d.user),
    events: (d.timeline || []).map(toEvent),
    subscriptions: d.subscription_history?.subscriptions || [],
    payments: d.subscription_history?.payments || [],
    topups: d.subscription_history?.topups || [],
    storageAddons: d.subscription_history?.storage_addons || [],
    storage: d.storage ? { totalGb: num(d.storage.total_gb), fileCount: num(d.storage.file_count) } : null,
    referralHistory: (d.referral_history || []).map((h) => ({
      level: h.level, changedAt: h.changed_at, previousCode: h.previous_code || null, previousOwner: h.previous_owner?.name || h.previous_owner || null,
      newCode: h.new_code || null, newOwner: h.new_owner?.name || h.new_owner || null, reason: h.reason || null,
      changedBy: h.changed_by?.name || h.changed_by?.email || null,
    })),
  }));

// ── Payments tab: captured payments of the users on one page ──────────────────
// The API has no cross-user payment list, so this pages through users that have payments
// (`has_payments=true`) and reads each one's history (GET /:userId), a few at a time.
const mapLimit = async (items, limit, fn) => {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

/**
 * @param {ReferralDataFilters} filters
 * @returns {Promise<{ items: import('./types/referralData.types').ReferralPaymentRow[], page: number, size: number, totalItems: number, totalPages: number, usersOnPage: number }>}
 */
export const getReferralPayments = async (filters) => {
  const page = toPage(await httpGet(`${E.list}${qs({ ...filterParams(filters), has_payments: 'true' })}`), toUserRow);
  const histories = await mapLimit(page.items, 4, (u) => getUserHistory(u.userId));
  const items = histories
    .flatMap((h) => h.events.filter((e) => e.type === EVENT_TYPE.PAYMENT).map((e) => ({ ...e, user: h.user })))
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  return { ...page, items, usersOnPage: page.items.length };
};

// ── GET /export → CSV generated by the server ─────────────────────────────────
const fileNameFromDisposition = (header) => {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header || '');
  return m ? decodeURIComponent(m[1]) : null;
};

const fetchCsv = async (url, fallbackName) => {
  const token = getToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) await parseResponse(res); // throws SalesReferralsApiError with the backend's error code
  const blob = await res.blob();
  if (!blob.size) throw new SalesReferralsApiError('Empty CSV response', { status: res.status, code: 'EMPTY_EXPORT' });
  const exported = res.headers.get('X-Exported-Rows');
  return { blob, fileName: fileNameFromDisposition(res.headers.get('Content-Disposition')) || fallbackName, rowCount: exported === null ? null : Number(exported) };
};

/**
 * @param {{ kind: import('./types/referralData.types').ExportKind, scope: import('./types/referralData.types').ExportScope, filters: ReferralDataFilters }} req
 * @returns {Promise<import('./types/referralData.types').CsvExportResult>}
 */
export const exportReferralDataCsv = async ({ kind = EXPORT_KIND.USERS, scope = EXPORT_SCOPE.FILTERED, filters }) => {
  const params = { mode: kind, ...(scope === EXPORT_SCOPE.ALL ? { sort: 'newest' } : filterParams(filters, { paged: false })) };
  const fallback = `onboarded-users${kind === EXPORT_KIND.HISTORY ? '-history' : ''}-${todayYmd()}.csv`;
  const res = await fetchCsv(`${E.export}${qs(params)}`, fallback);
  log.event('export:ok', { kind, scope, rows: res.rowCount, fileName: res.fileName });
  return res;
};

/**
 * "Download history" for one user: the API has no per-user CSV endpoint, so the already loaded
 * timeline (GET /:userId) is written to CSV in the browser with the same columns as `mode=history`.
 * @param {import('./types/referralData.types').UserHistory} history
 * @returns {import('./types/referralData.types').CsvExportResult}
 */
export const userHistoryCsv = (history) => {
  const rows = history.events.map((e) => ({ ...e, user: history.user }));
  return { blob: csvBlob(buildCsv(USER_HISTORY_CSV_COLUMNS, rows)), fileName: userHistoryFileName(history.user), rowCount: rows.length };
};

const referralDataApi = {
  getReferralDataOwners, getReferralDataSummary, getReferralDataStatusCounts, getReferralUsers, getUserHistory, getReferralPayments,
  exportReferralDataCsv, userHistoryCsv,
};
export default referralDataApi;
