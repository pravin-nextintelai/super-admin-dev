// Pure constants + formatters for the user-analytics view (kept separate from components
// so react-refresh / fast-refresh stays happy).

export const COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#64748b'];

const KB = 1024, MB = KB * 1024, GB = MB * 1024;

export const fmtBytes = (b) => {
  const n = Number(b) || 0;
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  if (n >= KB) return `${(n / KB).toFixed(1)} KB`;
  return `${n} B`;
};
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
export const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Indian digit grouping for an integer string: "1234567" → "12,34,567". */
const groupIndian = (intStr) => {
  const s = String(intStr).replace(/^0+(?=\d)/, '');
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
};

/**
 * Format an exact 2-dp money string from the API ("84.75", "1180.00") with Indian grouping and
 * WITHOUT re-rounding. Numbers are accepted too. null/undefined/'' → "₹0.00".
 */
export const fmtMoneyStr = (v, { currency = '₹' } = {}) => {
  if (v == null || v === '') return `${currency}0.00`;
  let s = typeof v === 'number' ? v.toFixed(2) : String(v).trim();
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [int = '0', dec = ''] = s.split('.');
  if (!/^\d+$/.test(int)) return `${currency}${v}`;
  const decimals = (dec + '00').slice(0, Math.max(2, dec.length));
  return `${neg ? '-' : ''}${currency}${groupIndian(int)}.${decimals}`;
};

/** Integer paise → "₹1,180.00". */
export const fmtPaise = (paise, opts) => {
  const n = Number(paise);
  if (!Number.isFinite(n)) return fmtMoneyStr(null, opts);
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  const str = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return fmtMoneyStr(neg ? `-${str}` : str, opts);
};

/** "12 Oct 2026, 05:30 pm" in IST; "—" when empty/invalid. */
export const fmtDateTimeIST = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** "12 Oct 2026" in IST. */
export const fmtDateIST = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
};

/** YYYY-MM-DD (as typed in a date input) → "12 Oct 2026". */
export const fmtYmd = (ymd) => (ymd ? fmtDate(`${ymd}T00:00:00`) : '—');

/** Seconds between two ISO timestamps as "1m 12s". */
export const fmtDuration = (from, to) => {
  if (!from) return '—';
  const a = new Date(from).getTime();
  const b = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—';
  const s = Math.round((b - a) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** "AMOUNT_MISMATCH" → "Amount mismatch". */
export const fmtIssueType = (t) => String(t || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Reconciliation run status → human label. */
export const fmtRunStatus = (s) => ({
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  completed_with_issues: 'Completed with issues',
  partial: 'Partial',
  failed: 'Failed',
}[s] || fmtIssueType(s));
