import Swal from 'sweetalert2';
import { CUSTOMER_APP_URLS } from '../../../config/config';
import withReactContent from 'sweetalert2-react-content';
import { PLAN_STATUS } from '../types/salesReferrals.types';
import { SALES_REFERRALS_TEXT, CODE_FORMAT_ERRORS, SALES_REFERRALS_ERROR_MESSAGES } from '../constants/salesReferrals.text';

const MySwal = withReactContent(Swal);

// ── Code rules ────────────────────────────────────────────────────────────────
export const CODE_MIN = 6;
export const CODE_MAX = 20;
export const MAX_CODES_PER_CREATE = 10;
const CODE_RE = /^[A-Z0-9-]{6,20}$/;

export const normalizeCode = (value) => String(value ?? '').toUpperCase().replace(/\s+/g, '');

/** @returns {string | null} error message, null when the format is fine */
export const codeFormatError = (code) => {
  const c = normalizeCode(code);
  if (!c) return CODE_FORMAT_ERRORS.empty;
  if (!CODE_RE.test(c)) return CODE_FORMAT_ERRORS.format;
  return null;
};

export const codesEqual = (a, b) => normalizeCode(a) === normalizeCode(b);

// ── Formatting ────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_PARTS = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
});
const istParts = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(IST_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return { day: p.day, month: MONTHS[Number(p.month) - 1], year: p.year, time: `${p.hour}:${p.minute}` };
};

/** "02 Sep 2026" (IST) */
export const fmtDate = (iso) => {
  const p = istParts(iso);
  return p ? `${p.day} ${p.month} ${p.year}` : '—';
};
/** "02 Sep 2026, 14:05" (IST) */
export const fmtDateTime = (iso) => {
  const p = istParts(iso);
  return p ? `${p.day} ${p.month} ${p.year}, ${p.time}` : '—';
};
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
export const pct = (part, whole) => (whole ? Math.round((Number(part) / Number(whole)) * 100) : 0);

export const initials = (name) =>
  String(name || '')
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';

const AVATAR_TONES = [
  'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700', 'bg-indigo-100 text-indigo-700',
];
export const avatarTone = (seed) => {
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
};

export const planStatusLabel = (status) => SALES_REFERRALS_TEXT.planStatus[status] || status;
export const isPaid = (status) => status === PLAN_STATUS.PAID;

// ── Share links ───────────────────────────────────────────────────────────────
/** Customer registration page path; `?ref=` carries the code. */
export const SIGNUP_PATH = '/register';
const signupPath = (code) => `${SIGNUP_PATH}?ref=${encodeURIComponent(normalizeCode(code))}`;

/**
 * Customer signup links for a code:
 *   live  → `https://jurinex-dev.netlify.app/register?ref=PRAV-7DQJ`
 *   local → `http://localhost:5173/register?ref=PRAV-7DQJ`, only while the admin panel runs on
 *           localhost; `null` in production so a single link is shown.
 */
export const referralLinks = (code) => ({
  live: `${CUSTOMER_APP_URLS.live}${signupPath(code)}`,
  local: CUSTOMER_APP_URLS.local ? `${CUSTOMER_APP_URLS.local}${signupPath(code)}` : null,
});
/** Live signup link (the one to share with customers). */
export const referralLink = (code) => referralLinks(code).live;

/** Multi-line message for "Copy all links": one line per code, or both links per code in local dev. */
export const allLinksMessage = (ownerName, codes) =>
  [
    SALES_REFERRALS_TEXT.share.allLinksHeader(ownerName),
    ...codes.flatMap((c) => {
      const l = referralLinks(c.code);
      const name = `${c.code}${c.label ? ` (${c.label})` : ''}`;
      if (!l.local) return [`${name}: ${l.live}`];
      return [name, `  ${SALES_REFERRALS_TEXT.share.live}: ${l.live}`, `  ${SALES_REFERRALS_TEXT.share.local}: ${l.local}`];
    }),
  ].join('\n');

// ── Clipboard + toast ─────────────────────────────────────────────────────────
export const toast = (icon, title, text) =>
  MySwal.fire({
    icon, title, text, toast: true, position: 'top-end',
    timer: icon === 'success' ? 2200 : 4000, timerProgressBar: false, showConfirmButton: false,
  });

export const copyText = async (text, successTitle = SALES_REFERRALS_TEXT.common.copied) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('success', successTitle);
    return true;
  } catch {
    toast('error', SALES_REFERRALS_TEXT.common.copyFailed, text);
    return false;
  }
};

/** UI message for an API error: mapped by `error.code` (doc §7), else the server message. */
export const errorText = (err) => {
  if (!err) return SALES_REFERRALS_TEXT.common.somethingWrong;
  const mapped = err.code && SALES_REFERRALS_ERROR_MESSAGES[err.code];
  if (err.code === 'VALIDATION_FAILED' && err.details) {
    const d = Array.isArray(err.details) ? err.details.map((x) => x?.message || x).filter(Boolean).join(' · ') : err.details.message;
    if (d) return d;
  }
  return mapped || err.message || SALES_REFERRALS_TEXT.common.somethingWrong;
};
export const REASON_MIN = 5;
export const REASON_MAX = 500;

// ── Date range presets ────────────────────────────────────────────────────────
const IST_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
export const todayYmd = () => IST_YMD.format(new Date());
export const daysAgoYmd = (n) => IST_YMD.format(new Date(Date.now() - n * 86400000));
export const monthStartYmd = () => `${todayYmd().slice(0, 7)}-01`;

export const DATE_PRESETS = Object.freeze([
  { id: 'all', label: SALES_REFERRALS_TEXT.dateRange.allTime, range: () => ({ from: null, to: null }) },
  { id: '7d', label: SALES_REFERRALS_TEXT.dateRange.last7, range: () => ({ from: daysAgoYmd(6), to: todayYmd() }) },
  { id: '30d', label: SALES_REFERRALS_TEXT.dateRange.last30, range: () => ({ from: daysAgoYmd(29), to: todayYmd() }) },
  { id: 'month', label: SALES_REFERRALS_TEXT.dateRange.thisMonth, range: () => ({ from: monthStartYmd(), to: todayYmd() }) },
]);

export const EMPTY_RANGE = Object.freeze({ from: null, to: null });

/** "02 Sep – 10 Oct 2026" style label for a range; "All time" when open. */
export const rangeLabel = (range) => {
  if (!range || (!range.from && !range.to)) return SALES_REFERRALS_TEXT.dateRange.allTime;
  const f = range.from ? fmtDate(`${range.from}T00:00:00+05:30`) : '…';
  const t = range.to ? fmtDate(`${range.to}T00:00:00+05:30`) : '…';
  return `${f} – ${t}`;
};
