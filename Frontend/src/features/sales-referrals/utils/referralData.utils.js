// Helpers for the "All referral data" page: formatting, filter chips, per-user history CSV columns.
import { REFERRAL_DATA_TEXT } from '../constants/referralData.text';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { fmtDate, rangeLabel, todayYmd } from './salesReferrals.utils';
import { slug } from './csv';

const T = REFERRAL_DATA_TEXT;

// ── Formatting ────────────────────────────────────────────────────────────────
/** "₹19,998" / "₹10.5" (en-IN grouping, up to 2 decimals). */
export const fmtInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const IST_TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
/** "4:40 PM" (IST) */
export const fmtTime12 = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : IST_TIME.format(d).replace(/\s/g, ' ');
};
/** "12 Oct 2026, 4:40 PM" (IST) */
export const fmtDateTime12 = (iso) => (iso ? `${fmtDate(iso)}, ${fmtTime12(iso)}` : '—');

export const ownerTypeLabel = (ownerType) =>
  ownerType === 'INTERNAL' ? SALES_REFERRALS_TEXT.type.internal : ownerType === 'OUTSOURCED' ? SALES_REFERRALS_TEXT.type.outsourced : '';

export const attributionLabel = (attribution) => (attribution ? T.attribution[attribution] || attribution : '');
export const eventLabel = (type) => T.events[type] || type;
export const planStatusText = (status) => SALES_REFERRALS_TEXT.planStatus[status] || status;
export const accountTypeLabel = (t) => (t ? T.accountTypes[t] || t : '');

/** Lower-case backend statuses (captured / completed / active / failed …) → badge tone. */
export const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (['captured', 'completed', 'active', 'success', 'paid'].includes(s)) return 'ok';
  if (['failed', 'refunded', 'blocked'].includes(s)) return 'bad';
  if (['pending', 'authorized', 'created', 'processing'].includes(s)) return 'warn';
  return 'muted';
};

// ── Active filters ────────────────────────────────────────────────────────────
/**
 * Removable chips for the filters that are on. `owners` resolves ids to names.
 * @returns {{ key: string, label: string }[]}
 */
export const activeFilterChips = (filters, owners = []) => {
  const chips = [];
  const F = T.filters.chips;
  if (filters.dateRange?.from || filters.dateRange?.to) chips.push({ key: 'dateRange', label: F.dateRange(rangeLabel(filters.dateRange)) });
  if (filters.ownerId) {
    const owner = owners.find((o) => o.id === filters.ownerId);
    chips.push({ key: 'ownerId', label: F.owner(owner?.name || filters.ownerId) });
  }
  if (filters.code) chips.push({ key: 'code', label: F.code(filters.code) });
  if (filters.ownerType && filters.ownerType !== 'ALL') chips.push({ key: 'ownerType', label: F.type(ownerTypeLabel(filters.ownerType)) });
  if (filters.planStatus && filters.planStatus !== 'ALL') chips.push({ key: 'planStatus', label: F.status(planStatusText(filters.planStatus)) });
  if (filters.search) chips.push({ key: 'search', label: F.search(filters.search) });
  if (filters.includeDirect === false) chips.push({ key: 'includeDirect', label: F.directHidden });
  return chips;
};

// ── Per-user history CSV (built in the browser from GET /:userId; same columns as /export?mode=history)
export const USER_HISTORY_CSV_COLUMNS = Object.freeze([
  { key: 'userId', header: 'User id', value: (r) => r.user.userId },
  { key: 'email', header: 'Email', value: (r) => r.user.userEmail },
  { key: 'name', header: 'Name', value: (r) => r.user.userName },
  { key: 'channel', header: 'Onboarding channel', value: (r) => r.user.channel },
  { key: 'owner', header: 'Sales owner', value: (r) => r.user.ownerName || '' },
  { key: 'code', header: 'Referral code', value: (r) => r.user.code || '' },
  { key: 'workspace', header: 'Workspace', value: (r) => r.user.workspace?.name || '' },
  { key: 'eventIst', header: 'Event (IST)', value: (r) => fmtDateTime12(r.occurredAt) },
  { key: 'eventType', header: 'Event type', value: (r) => r.type },
  { key: 'title', header: 'Title', value: (r) => r.title },
  { key: 'detail', header: 'Detail', value: (r) => r.detail || '' },
  { key: 'status', header: 'Status', value: (r) => r.status || '' },
  { key: 'amount', header: 'Amount', value: (r) => (r.amountInr === null ? '' : r.amountInr) },
  { key: 'currency', header: 'Currency', value: (r) => r.currency || '' },
  { key: 'refId', header: 'Reference id', value: (r) => r.refId ?? '' },
  { key: 'eventUtc', header: 'Event (UTC)', value: (r) => r.occurredAt },
]);

export const userHistoryFileName = (user) => `subscription-history-${slug(user.userName || user.userEmail) || user.userId}-${todayYmd()}.csv`;

// ── Tabs ──────────────────────────────────────────────────────────────────────
export const DATA_TAB = Object.freeze({ USERS: 'USERS', PAYMENTS: 'PAYMENTS' });
export const tabId = (id) => `referral-data-tab-${id}`;
export const panelId = (id) => `referral-data-panel-${id}`;
