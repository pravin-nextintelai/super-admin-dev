import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, RefreshCw, Search, Download, X, ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, AlertCircle, Copy, Globe, Server, Cpu, Link2,
} from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import auditLogApi from '../../services/auditLogApi';
import { createDebugLogger } from '../../utils/debugLogger';

const MySwal = withReactContent(Swal);
const log = createDebugLogger('AuditLogs');

const PAGE_SIZE_OPTIONS = [10, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

// ── IST period presets ─────────────────────────────────────────────────────────
// All filtering is in IST: the backend treats a plain YYYY-MM-DD as an inclusive
// IST calendar day. 'en-CA' formats as YYYY-MM-DD.
const IST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const istToday = () => IST_DATE.format(new Date());
const istDaysAgo = (n) => IST_DATE.format(new Date(Date.now() - n * 86400000));

const RANGE_PRESETS = [
  { id: 'today', label: 'Today', from: () => istToday(), to: () => istToday() },
  { id: 'yesterday', label: 'Yesterday', from: () => istDaysAgo(1), to: () => istDaysAgo(1) },
  { id: '7d', label: 'Last 7 Days', from: () => istDaysAgo(6), to: () => istToday() },
  { id: '30d', label: 'Last 30 Days', from: () => istDaysAgo(29), to: () => istToday() },
];

// ── Display config ─────────────────────────────────────────────────────────────
const STATUS_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
];

const KIND_OPTIONS = [
  { value: '', label: 'All kinds' },
  { value: 'request', label: 'Request' },
  { value: 'browser', label: 'Browser' },
  { value: 'job', label: 'Job' },
];
const KIND_ICON = { request: Server, browser: Globe, job: Cpu };

const ACTION_OPTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'slowest', label: 'Slowest first' },
  { value: 'status', label: 'Failed first' },
  { value: 'service', label: 'Service' },
  { value: 'user', label: 'User' },
];

// Badges share one soft gray pill; only the text colour varies, and most
// values stay gray so the table reads quietly.
const BADGE_BASE = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap';
const BADGE_TEXT_DEFAULT = 'text-gray-600';

const ACTION_TEXT = { CREATE: 'text-emerald-600', UPDATE: 'text-amber-600', DELETE: 'text-red-600' };
const RESOURCE_TEXT = {
  CASE: 'text-blue-600', FILE: 'text-orange-600', CHAT: 'text-purple-600', USER: 'text-indigo-600',
  PLAN: 'text-rose-600', 'STORAGE FOLDER': 'text-gray-600',
};
const HTTP_METHOD_TEXT = { GET: 'text-emerald-600', POST: 'text-blue-600', PUT: 'text-amber-600', PATCH: 'text-amber-600', DELETE: 'text-red-600' };
const SEVERITY_TEXT = { CRITICAL: 'text-red-700 font-bold', ERROR: 'text-red-600', WARNING: 'text-amber-600' };

// ── Helpers ────────────────────────────────────────────────────────────────────
const ist = (obj, key = 'display') => (obj && obj[key]) || '—';
const num = (n) => (n == null ? '—' : Number(n).toLocaleString());
const codeColor = (code) => (code >= 500 ? 'text-red-700' : code >= 400 ? 'text-amber-700' : 'text-gray-700');

/** "Sep 9 – Oct 8" from two YYYY-MM-DD strings (filter values, not API timestamps). */
const shortDate = (ymd) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};
const rangeLabel = ({ from, to }) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);

const todayHeading = () =>
  new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const relative = (date, now) => {
  const diff = Math.max(0, Math.floor((now - date) / 1000));
  if (diff < 60) return 'less than a minute ago';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
};

const errorText = (err) => {
  if (!err) return 'Something went wrong';
  if (err.details?.length) return err.details.join(' · ');
  return err.message || 'Something went wrong';
};
const toast = (icon, title, text) =>
  MySwal.fire({ icon, title, text, timer: icon === 'success' ? 2200 : undefined, showConfirmButton: icon !== 'success', toast: true, position: 'top-end' });

// ── Small components ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) =>
  status === 'FAILED' ? (
    <span className={`${BADGE_BASE} text-red-600`}><XCircle className="w-3 h-3" /> Failed</span>
  ) : (
    <span className={`${BADGE_BASE} text-emerald-600`}><CheckCircle2 className="w-3 h-3" /> Success</span>
  );

const ActionBadge = ({ action }) =>
  action ? <span className={`${BADGE_BASE} ${ACTION_TEXT[action] || BADGE_TEXT_DEFAULT}`}>{action}</span> : <span className="text-gray-300">—</span>;

const ResourceBadge = ({ resourceType }) =>
  resourceType ? <span className={`${BADGE_BASE} ${RESOURCE_TEXT[resourceType] || BADGE_TEXT_DEFAULT}`}>{resourceType}</span> : <span className="text-gray-300">—</span>;

const MethodBadge = ({ method }) =>
  method ? <span className={`${BADGE_BASE} px-1.5 py-0.5 font-mono ${HTTP_METHOD_TEXT[method] || BADGE_TEXT_DEFAULT}`}>{method}</span> : null;

const KindBadge = ({ kind }) => {
  const Icon = KIND_ICON[kind] || Server;
  return <span className={`${BADGE_BASE} ${BADGE_TEXT_DEFAULT}`}><Icon className="w-3 h-3" /> {kind || 'request'}</span>;
};

const Pill = ({ children, className = BADGE_TEXT_DEFAULT }) => <span className={`${BADGE_BASE} ${className}`}>{children}</span>;

const StatCard = ({ label, value, sub, accent }) => (
  <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
    <p className={`mt-1 text-2xl font-bold truncate ${accent || 'text-gray-900'}`} title={typeof value === 'string' ? value : undefined}>{value ?? '—'}</p>
    {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
  </div>
);

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
    <div className="text-sm text-gray-800">{children}</div>
  </div>
);

const SelectBox = ({ value, onChange, children, className = '', minWidth }) => (
  <div className={`relative ${className}`} style={minWidth ? { minWidth } : undefined}>
    <select
      value={value}
      onChange={onChange}
      className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
    >
      {children}
    </select>
    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
  </div>
);

const Pre = ({ children, tone = 'gray' }) => (
  <pre
    className={`font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all rounded-lg border px-3 py-2 max-h-80 overflow-auto custom-scrollbar ${
      tone === 'red' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-gray-50 border-gray-200 text-gray-800'
    }`}
  >
    {children}
  </pre>
);

// Column widths for the fixed-layout table (percent of the container), so the
// table always fits the page and long values wrap or truncate inside their cell.
const COLUMNS = [
  { label: 'Timestamp', width: '12%' },
  { label: 'User', width: '12%' },
  { label: 'Service', width: '11%' },
  { label: 'Action', width: '6%' },
  { label: 'Resource Type', width: '9%' },
  { label: 'Method', width: '11%' },
  { label: 'API', width: '14%' },
  { label: 'Status', width: '7%' },
  { label: 'Code', width: '5%' },
  { label: 'Duration', width: '6%' },
  { label: 'IP Address', width: '7%' },
];

// ══════════════════════════════════════════════════════════════════════════════
const AuditLogs = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Summary / meta ───────────────────────────────────────────────────────────
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [meta, setMeta] = useState(null);

  // ── List ─────────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [now, setNow] = useState(new Date());

  // ── Period (IST) ─────────────────────────────────────────────────────────────
  const [preset, setPreset] = useState('7d');
  const [range, setRange] = useState(() => ({ from: istDaysAgo(6), to: istToday() }));

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [hidePings, setHidePings] = useState(true);
  const [userInput, setUserInput] = useState(searchParams.get('user') || '');
  const [user, setUser] = useState(searchParams.get('user') || '');
  const [service, setService] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [action, setAction] = useState('');
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // ── Detail drawer ────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filterParams = useMemo(() => ({
    from: range.from,
    to: range.to,
    user: user || undefined,
    service: service || undefined,
    status: status !== 'all' ? status : undefined,
    resource_type: resourceType || undefined,
    action: action || undefined,
    kind: kind || undefined,
    q: q || undefined,
    exclude_pings: hidePings ? undefined : 'false', // server default is true
    sort,
  }), [range, user, service, status, resourceType, action, kind, q, hidePings, sort]);

  const listParams = useMemo(() => ({ ...filterParams, page, page_size: pageSize }), [filterParams, page, pageSize]);

  // Summary ignores status / sort so the status chips keep whole-period counts.
  const summaryParams = useMemo(() => ({
    from: range.from, to: range.to, user: user || undefined, service: service || undefined,
    kind: kind || undefined, exclude_pings: hidePings ? undefined : 'false',
  }), [range, user, service, kind, hidePings]);

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async (params) => {
    setSummaryLoading(true);
    try {
      const data = await auditLogApi.getSummary(params);
      setSummary(data);
      log.flow('summary:loaded', {
        summary: {
          calls: data.totals?.calls, failed: data.totals?.failed, failureRatePct: data.totals?.failure_rate_pct,
          avgMs: data.totals?.avg_ms, p95Ms: data.totals?.p95_ms, users: data.totals?.distinct_users,
          mostUsed: data.totals?.most_used_api?.route, periodIST: `${data.period?.from_ist?.date} → ${data.period?.to_ist?.date}`,
        },
      });
    } catch (err) {
      log.error('summary:error', err);
    } finally { setSummaryLoading(false); }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const data = await auditLogApi.getMeta();
      setMeta(data);
      log.flow('meta:loaded', { summary: { services: data.used?.services?.length, resourceTypes: data.used?.resource_types?.length, pageSize: data.defaults?.page_size } });
    } catch (err) {
      log.error('meta:error', err);
    }
  }, []);

  const fetchList = useCallback(async (params) => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await auditLogApi.list(params);
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setTotalPages(Math.max(1, data.total_pages || 1));
      setLastUpdated(new Date());
      log.flow('list:loaded', {
        summary: { page: data.page, pageSize: data.page_size, total: data.total, returned: data.rows?.length, status: data.filters?.status, user: data.filters?.user, userResolved: data.filters?.user_resolved?.email, excludePings: data.filters?.exclude_pings },
        table: (data.rows || []).slice(0, 8).map((r) => ({ at: r.created_at_ist?.time, user: r.user_email, service: r.service_name, api: r.api, status: r.status, code: r.status_code, ms: r.duration_ms })),
      });
    } catch (err) {
      log.error('list:error', err);
      setListError(errorText(err));
    } finally { setListLoading(false); }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const data = await auditLogApi.get(id);
      setDetail(data);
      log.flow('detail:loaded', { summary: { id, status: data.audit?.status, api: data.audit?.api, errorLogId: data.audit?.error_log_id, linkedErrors: data.errors?.length, hasStack: Boolean(data.audit?.stack_trace || data.error?.stack_trace) } });
    } catch (err) {
      log.error('detail:error', err);
      toast('error', 'Could not load the call', errorText(err));
      setSelectedId(null);
    } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchSummary(summaryParams); }, [fetchSummary, summaryParams]);
  useEffect(() => { fetchList(listParams); }, [fetchList, listParams]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); else setDetail(null); }, [selectedId, fetchDetail]);

  // Keep the "Last updated x ago" line ticking.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Mirror the user filter into the URL so a link can open the page pre-filtered.
  useEffect(() => {
    const current = searchParams.get('user') || '';
    if (current === user) return;
    setSearchParams(user ? { user } : {}, { replace: true });
  }, [user, searchParams, setSearchParams]);

  // Debounce the free-text user filter.
  useEffect(() => {
    const value = userInput.trim();
    if (value === user) return undefined;
    const id = setTimeout(() => { setUser(value); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [userInput, user]);

  const resetToFirstPage = () => setPage(1);
  const refreshAll = () => { fetchSummary(summaryParams); fetchList(listParams); if (selectedId) fetchDetail(selectedId); };

  const applyPreset = (p) => {
    setPreset(p.id);
    setRange({ from: p.from(), to: p.to() });
    resetToFirstPage();
  };

  const applySearch = () => { setQ(searchInput.trim()); resetToFirstPage(); };
  const clearFilters = () => {
    setStatus('all'); setSearchInput(''); setQ(''); setUserInput(''); setUser(''); setService(''); setResourceType('');
    setAction(''); setKind(''); setSort('newest'); setPage(1);
  };
  const activeFilterCount = [service, resourceType, action, kind].filter(Boolean).length + (sort !== 'newest' ? 1 : 0);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, fileName, totalRows, exportedRows } = await auditLogApi.exportCsv(filterParams);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      log.flow('export:done', { summary: { fileName, totalRows, exportedRows } });
      toast('success', `Exported ${num(exportedRows)} of ${num(totalRows)} rows`);
    } catch (err) {
      log.error('export:error', err);
      toast('error', 'Export failed', errorText(err));
    } finally { setExporting(false); }
  };

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); toast('success', `${label} copied`); } catch { /* ignore */ }
  };

  const t = summary?.totals;
  const chipCount = (value) => (value === 'all' ? t?.calls : value === 'SUCCESS' ? t?.succeeded : t?.failed);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 min-w-0 max-w-full">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-indigo-600" />
            Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Every API call across all services, with the error behind each failure · all times in IST</p>
        </div>
        <p className="text-sm text-gray-500 pt-1">{todayHeading()}</p>
      </div>

      {/* KPI cards */}
      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total calls" value={num(t.calls)} sub={`${num(t.distinct_users)} users · ${num(t.services)} services`} />
          <StatCard label="Failed" value={num(t.failed)} accent="text-red-600" sub={`${num(t.users_with_failures)} users affected`} />
          <StatCard label="Failure rate" value={`${t.failure_rate_pct ?? 0}%`} accent="text-amber-600" sub={`${num(t.http_4xx)} × 4xx · ${num(t.http_5xx)} × 5xx`} />
          <StatCard label="Avg duration" value={`${num(t.avg_ms)} ms`} sub={`p50 ${num(t.p50_ms)} ms · p95 ${num(t.p95_ms)} ms`} />
          <StatCard
            label="Most used API"
            value={t.most_used_api ? `${t.most_used_api.http_method || ''} ${t.most_used_api.route || t.most_used_api.endpoint || ''}`.trim() : '—'}
            sub={t.most_used_api ? `${num(t.most_used_api.calls)} calls · ${t.most_used_api.service_name}` : 'no calls in this period'}
          />
        </div>
      )}

      {/* Period + actions card */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 mr-1">Period</span>
            {[...RANGE_PRESETS, { id: 'custom', label: 'Custom' }].map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => (p.id === 'custom' ? setPreset('custom') : applyPreset(p))}
                  aria-pressed={active}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting || total === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download the current filter as CSV (IST columns, max 50 000 rows)"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exporting…' : `Export (${rangeLabel(range)})`}
            </button>
            <button
              type="button"
              onClick={refreshAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
            >
              <RefreshCw className={`w-4 h-4 ${summaryLoading || listLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              <span className="font-medium">From</span>
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); resetToFirstPage(); }}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-gray-600">
              <span className="font-medium">To</span>
              <input
                type="date"
                value={range.to}
                min={range.from}
                max={istToday()}
                onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); resetToFirstPage(); }}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </label>
            <span className="text-xs text-gray-400">IST calendar days</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_CHIPS.map((b) => {
              const count = chipCount(b.value);
              const active = status === b.value;
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => { setStatus(b.value); resetToFirstPage(); }}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${active ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {b.label}{count !== undefined && <span className={`ml-1.5 text-xs ${active ? 'text-gray-300' : 'text-gray-400'}`}>{num(count)}</span>}
                </button>
              );
            })}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none" title="Hides /api/auth/activity/ping rows (exclude_pings)">
            <button
              type="button"
              role="switch"
              aria-checked={hidePings}
              onClick={() => { setHidePings((v) => !v); resetToFirstPage(); }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hidePings ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${hidePings ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            Hide activity pings
          </label>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search endpoint, handler, error, user, request id…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                maxLength={200}
                className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-72"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setQ(''); resetToFirstPage(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button type="button" onClick={applySearch} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition">Search</button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${showFilters || activeFilterCount ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              Filters{activeFilterCount > 0 && <span className="px-1.5 rounded-full bg-indigo-600 text-white text-[11px]">{activeFilterCount}</span>}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
            <Field label="Service">
              <SelectBox value={service} onChange={(e) => { setService(e.target.value); resetToFirstPage(); }}>
                <option value="">All services</option>
                {(meta?.used?.services || []).map((x) => <option key={x.value} value={x.value}>{x.value} ({x.count})</option>)}
              </SelectBox>
            </Field>
            <Field label="Resource type">
              <SelectBox value={resourceType} onChange={(e) => { setResourceType(e.target.value); resetToFirstPage(); }}>
                <option value="">All resources</option>
                {(meta?.used?.resource_types || []).map((x) => <option key={x.value} value={x.value}>{x.value} ({x.count})</option>)}
              </SelectBox>
            </Field>
            <Field label="Action">
              <SelectBox value={action} onChange={(e) => { setAction(e.target.value); resetToFirstPage(); }}>
                <option value="">All actions</option>
                {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </SelectBox>
            </Field>
            <Field label="Kind">
              <SelectBox value={kind} onChange={(e) => { setKind(e.target.value); resetToFirstPage(); }}>
                {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </SelectBox>
            </Field>
            <Field label="Sort">
              <div className="flex gap-2">
                <SelectBox className="flex-1" value={sort} onChange={(e) => { setSort(e.target.value); resetToFirstPage(); }}>
                  {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </SelectBox>
                <button type="button" onClick={clearFilters} className="px-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50" title="Clear all filters"><X className="w-4 h-4" /></button>
              </div>
            </Field>
          </div>
        )}

        <p className="text-xs text-gray-500">Last updated {relative(lastUpdated, now)}</p>
      </div>

      {listError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {listError}
        </div>
      )}

      {/* Results summary + user filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{num(first)}–{num(last)}</span> of{' '}
          <span className="font-semibold text-gray-900">{num(total)}</span> results
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">User</span>
          <div className="relative">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="All users — type an email or id"
              className="pl-3 pr-8 py-2 min-w-[260px] border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            {userInput && (
              <button
                type="button"
                onClick={() => { setUserInput(''); setUser(''); resetToFirstPage(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-700"
                aria-label="Clear user filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {listLoading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No API calls found for this period</p>
            {(q || user || activeFilterCount > 0 || status !== 'all') && (
              <button type="button" onClick={clearFilters} className="mt-3 text-sm text-indigo-700 font-medium hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className={`w-full overflow-x-auto ${listLoading ? 'opacity-60' : ''}`}>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                {COLUMNS.map((c) => <col key={c.label} style={{ width: c.width }} />)}
              </colgroup>
              <thead className="bg-gray-100">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.label} className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`cursor-pointer transition-colors ${selectedId === r.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-3 py-3.5 align-top">
                      <p className="text-gray-800 whitespace-nowrap">{ist(r.created_at_ist, 'date')} {ist(r.created_at_ist, 'time24')}</p>
                      {r.request_id && <p className="text-[10px] text-gray-400 font-mono truncate" title={`Request id ${r.request_id}`}>{r.request_id}</p>}
                    </td>
                    <td className="px-3 py-3.5 align-top min-w-0">
                      {r.user_email || r.user_id ? (
                        <>
                          <p className="text-gray-800 truncate" title={r.user_email || ''}>{r.user_email || `user #${r.user_id}`}</p>
                          {r.user_name && <p className="text-[11px] text-gray-500 truncate">{r.user_name}</p>}
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3.5 align-top min-w-0">
                      <p className="text-gray-800 truncate" title={r.service_name}>{r.service_name}</p>
                      {r.environment && <p className="text-[11px] text-gray-400 truncate">{r.environment}</p>}
                    </td>
                    <td className="px-3 py-3.5 align-top"><ActionBadge action={r.action} /></td>
                    <td className="px-3 py-3.5 align-top min-w-0">
                      <ResourceBadge resourceType={r.resource_type} />
                      {r.resource_id && <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5" title={r.resource_id}>{r.resource_id}</p>}
                    </td>
                    <td className="px-3 py-3.5 align-top min-w-0">
                      <span className="block font-mono text-xs text-gray-700 truncate" title={r.method || ''}>{r.method || '—'}</span>
                    </td>
                    <td className="px-3 py-3.5 align-top min-w-0">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <MethodBadge method={r.http_method} />
                        <span className="font-mono text-xs text-gray-700 line-clamp-2 break-all" title={r.endpoint || ''}>{r.endpoint || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-top"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-3.5 align-top">
                      <span className={`font-mono text-xs font-semibold ${codeColor(r.status_code)}`}>{r.status_code ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3.5 align-top whitespace-nowrap text-gray-700">{r.duration_display || '—'}</td>
                    <td className="px-3 py-3.5 align-top min-w-0">
                      <span className="block font-mono text-xs text-gray-700 truncate" title={r.ip_address || ''}>{r.ip_address || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && !listError && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50/60">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{num(first)}–{num(last)}</span> of{' '}
                <span className="font-semibold text-gray-700">{num(total)}</span> results
              </p>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                Rows per page
                <span className="relative">
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="appearance-none pl-2.5 pr-7 py-1 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || listLoading}
                className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-gray-600">Page {num(page)} of {num(totalPages)}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || listLoading}
                className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════ DETAIL DRAWER ═══════════════════════════════ */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20" onClick={() => setSelectedId(null)}>
          <aside
            className="w-full max-w-2xl h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="API call detail"
          >
            {detailLoading && !detail ? (
              <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" /></div>
            ) : detail?.audit ? (() => {
              const a = detail.audit;
              const err = detail.error;
              const others = (detail.errors || []).filter((e) => e.id !== err?.id);
              const stack = a.stack_trace || err?.stack_trace || null;
              return (
                <>
                  {/* Drawer header */}
                  <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={a.status} />
                        <h3 className="text-base font-semibold text-gray-900">API Call Detail</h3>
                        <span className={`font-mono text-sm font-semibold ${codeColor(a.status_code)}`}>{a.status_code ?? '—'}</span>
                        <span className="text-xs text-gray-500">{a.duration_display || '—'}</span>
                        <KindBadge kind={a.kind} />
                      </div>
                      <p className="font-mono text-xs text-gray-700 mt-1.5 break-all">{a.api || a.endpoint || '—'}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition" aria-label="Close"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-5">

                    {/* Request */}
                    <section>
                      <Field label="Request">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2">
                          <Field label="Timestamp (IST)">{ist(a.created_at_ist)}{a.occurred_ago && <span className="text-gray-400 text-xs"> · {a.occurred_ago} ago</span>}</Field>
                          <Field label="User">
                            {a.user_email || a.user_id ? (
                              <>
                                <p className="text-gray-900 break-all">{a.user_email || '—'}</p>
                                <p className="text-xs text-gray-500">{[a.user_name, a.user_id ? `id ${a.user_id}` : null].filter(Boolean).join(' · ') || '—'}</p>
                              </>
                            ) : <span className="text-gray-400 italic">Unauthenticated / service call</span>}
                          </Field>
                          <Field label="Service">{a.service_name}{a.environment && <span className="text-gray-400 text-xs"> · {a.environment}</span>}</Field>
                          <Field label="Request id">
                            {a.request_id ? (
                              <button type="button" onClick={() => copy(a.request_id, 'Request id')} className="font-mono text-xs text-gray-700 hover:text-indigo-700 inline-flex items-center gap-1 break-all" title="Copy request id">{a.request_id}<Copy className="w-3 h-3 flex-shrink-0" /></button>
                            ) : <span className="text-gray-400">—</span>}
                          </Field>
                          <Field label="IP address"><span className="font-mono text-xs">{a.ip_address || '—'}</span></Field>
                          <Field label="User agent"><span className="block text-xs text-gray-600 truncate" title={a.user_agent || ''}>{a.user_agent || '—'}</span></Field>
                          <Field label="Kind"><KindBadge kind={a.kind} /></Field>
                          <Field label="Action"><ActionBadge action={a.action} /></Field>
                          <Field label="Resource">
                            <ResourceBadge resourceType={a.resource_type} />
                            {a.resource_id && <p className="font-mono text-xs text-gray-500 break-all mt-0.5">{a.resource_id}</p>}
                          </Field>
                          <Field label="Method (handler)"><span className="font-mono text-xs break-all">{a.method || '—'}</span></Field>
                          <Field label="Route"><span className="font-mono text-xs break-all">{a.route || <span className="text-gray-400">—</span>}</span></Field>
                          <Field label="Duration">{a.duration_display || '—'}{a.streaming && <span className="text-gray-400 text-xs"> · streamed</span>}</Field>
                        </dl>
                      </Field>
                    </section>

                    {/* Error (failed calls only) */}
                    {a.status === 'FAILED' && (
                      <section className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Error</p>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Error type"><span className="font-mono text-xs">{a.error_type || err?.error_type || '—'}</span></Field>
                            <Field label="What the user saw">{a.user_message || err?.user_message || <span className="text-gray-400">—</span>}</Field>
                          </div>
                          <Field label="Error message">
                            <code className="block font-mono text-xs text-red-800 bg-white border border-red-200 rounded-md px-2.5 py-2 break-all">{a.error_message || err?.error_message || '—'}</code>
                          </Field>
                          <Field label={a.stack_trace ? 'Stack trace' : 'Stack trace (from the linked error_logs entry)'}>
                            {stack ? <Pre tone="red">{stack}</Pre> : <span className="text-gray-400 text-xs">No stack trace was recorded for this call.</span>}
                          </Field>
                        </div>
                      </section>
                    )}

                    {/* Linked error_logs entry */}
                    {err && (
                      <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-gray-500" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Linked error log entry</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {err.severity && <Pill className={SEVERITY_TEXT[err.severity] || BADGE_TEXT_DEFAULT}>{err.severity_label || err.severity}</Pill>}
                          {err.source && <Pill className="text-blue-600">{err.source_label || err.source}</Pill>}
                          {err.category && <Pill className="text-purple-600">{err.category_label || err.category}</Pill>}
                          <Pill className={err.is_resolved ? 'text-emerald-600' : 'text-amber-600'}>{err.is_resolved ? 'Resolved' : 'Unresolved'}</Pill>
                          {err.occurrence_count > 1 && <span className="text-xs text-gray-500">{num(err.occurrence_count)} occurrences of this issue</span>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                          <Field label="error_logs id" className="sm:col-span-2">
                            <button type="button" onClick={() => copy(err.id, 'error_logs id')} className="font-mono text-xs text-gray-700 hover:text-indigo-700 inline-flex items-center gap-1 break-all" title="Copy error_logs id">{err.id}<Copy className="w-3 h-3 flex-shrink-0" /></button>
                          </Field>
                          <Field label="Service">{err.service_name}{err.method && <p className="font-mono text-[11px] text-gray-500 break-all">{err.method}</p>}</Field>
                          <Field label="Error type"><span className="font-mono text-xs">{err.error_type || '—'}</span></Field>
                          <Field label="Error message" className="sm:col-span-2">
                            <code className="block font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-2 break-all">{err.error_message || '—'}</code>
                          </Field>
                          {err.user_message && <Field label="What the user saw" className="sm:col-span-2">{err.user_message}</Field>}
                          {err.external && (
                            <Field label="External call" className="sm:col-span-2">
                              <p className="text-xs text-gray-700">
                                <span className="font-semibold">{err.external.provider || '—'}</span>
                                {err.external.status_code != null && <span className="font-mono"> · HTTP {err.external.status_code}</span>}
                                {err.external.error_code && <span className="font-mono"> · {err.external.error_code}</span>}
                              </p>
                              {err.external.endpoint && <p className="font-mono text-[11px] text-gray-500 break-all">{err.external.endpoint}</p>}
                              {err.external.response && <div className="mt-1.5"><Pre tone="red">{err.external.response}</Pre></div>}
                            </Field>
                          )}
                          {err.stack_trace && a.stack_trace && (
                            <Field label="Stack trace" className="sm:col-span-2"><Pre tone="red">{err.stack_trace}</Pre></Field>
                          )}
                        </div>
                        {others.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Other errors stored for this request ({others.length})</p>
                            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                              {others.map((o) => (
                                <li key={o.id} className="px-3 py-2 flex items-center gap-2 text-xs">
                                  {o.severity && <Pill className={SEVERITY_TEXT[o.severity] || BADGE_TEXT_DEFAULT}>{o.severity}</Pill>}
                                  <span className="font-mono text-gray-800 truncate" title={o.error_message || ''}>{o.error_type || o.category || 'error'}{o.error_message ? `: ${o.error_message}` : ''}</span>
                                  <button type="button" onClick={() => copy(o.id, 'error_logs id')} className="ml-auto font-mono text-[10px] text-gray-400 hover:text-indigo-700 inline-flex items-center gap-1 flex-shrink-0" title={`error_logs id ${o.id}`}>{o.id.slice(0, 8)}…<Copy className="w-3 h-3" /></button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </section>
                    )}

                    {/* Payload */}
                    {a.payload != null && (
                      <Field label="Payload">
                        <Pre>{JSON.stringify(a.payload, null, 2)}</Pre>
                      </Field>
                    )}
                  </div>

                  {/* Drawer footer */}
                  <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
                    <button type="button" onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white transition"><X className="w-4 h-4" />Close</button>
                  </div>
                </>
              );
            })() : null}
          </aside>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
