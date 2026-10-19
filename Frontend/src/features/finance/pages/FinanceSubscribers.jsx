import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Eye, FileText, Lock, ReceiptText,
  RefreshCw, Search, Tag, Users, X,
} from 'lucide-react';
import SetWorkspaceReferralDialog from '../../sales-referrals/dialogs/SetWorkspaceReferralDialog';
import { fmtDateIST, fmtDateTimeIST, fmtMoneyStr, fmtNum, fmtYmd } from '../../users/userAnalytics/analyticsFormat';
import { downloadUsersPlanDocument, downloadUsersPlansCsv, fetchUsersPlans } from '../../users/userAnalytics/analyticsApi';
import UserPlanDetailDrawer, { Pill } from '../../users/userAnalytics/UserPlanDetailDrawer';
import ToastStack from '../../users/userAnalytics/ToastStack';
import useToasts from '../../users/userAnalytics/useToasts';
import { createDebugLogger } from '../../../shared/utils/debugLogger';

const log = createDebugLogger('FinanceSubscribers');
const PAGE_SIZE_OPTIONS = [10, 50, 100];
const PLAN_OPTIONS = [
  { key: 'free', label: 'Free' }, { key: 'pro', label: 'Pro' }, { key: 'plus', label: 'Plus' }, { key: 'lite', label: 'Lite' }, { key: 'enterprise', label: 'Enterprise' },
];
const OWNER_TYPES = ['INTERNAL', 'OUTSOURCED', 'DIRECT'];
const USER_STATUSES = ['new', 'active', 'inactive', 'blocked', 'pending'];
const USER_SORT = ['joined', 'username', 'email', 'plan', 'user_status', 'sales_owner', 'purchase_date', 'total_amount'];
const TX_SORT = ['purchase_date', 'total_amount', 'status'];

const fieldClass =
  'h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all';
const activeFieldClass = 'border-blue-400 bg-blue-50 text-blue-800 font-medium';
const btnClass = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50';

const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DATE_PRESETS = [
  { key: 'today', label: 'Today', range: () => { const t = isoDay(new Date()); return [t, t]; } },
  { key: 'this-month', label: 'This month', range: () => { const n = new Date(); return [isoDay(new Date(n.getFullYear(), n.getMonth(), 1)), isoDay(n)]; } },
  { key: 'last-month', label: 'Last month', range: () => { const n = new Date(); return [isoDay(new Date(n.getFullYear(), n.getMonth() - 1, 1)), isoDay(new Date(n.getFullYear(), n.getMonth(), 0))]; } },
];
const titleCase = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1).toLowerCase();

function pageNumbers(current, total) {
  if (total <= 1) return [1];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) out.push('…'); out.push(n); });
  return out;
}

const EMPTY_FILTERS = { search: '', plan: '', topupPlanId: '', ownerType: '', includeDirect: true, ownerId: '', code: '', userStatus: '', fromDate: '', toDate: '' };
const toQuery = (f) => ({
  search: f.search?.trim() || undefined,
  plan: f.plan || undefined,
  topupPlanId: f.topupPlanId || undefined,
  ownerType: f.ownerType || undefined,
  includeDirect: f.includeDirect === false ? '0' : undefined,
  ownerId: f.ownerId || undefined,
  code: f.code?.trim() || undefined,
  userStatus: f.userStatus || undefined,
  from: f.fromDate || undefined,
  to: f.toDate || undefined,
});
const countFilters = (f) => Object.values(toQuery(f)).filter(Boolean).length;
const saveBlob = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
};

const Mono = ({ children, className = '' }) => (children
  ? <span className={`font-mono text-[11px] text-slate-700 break-all ${className}`}>{children}</span>
  : <span className="text-slate-400">—</span>);

const OptionCard = ({ name, value, checked, onChange, title, help, meta, inputRef }) => (
  <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${checked ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300'}`}>
    <input ref={inputRef} type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 accent-blue-600" />
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-slate-800">{title}</span>
      <span className="block text-xs text-slate-500 mt-0.5">{help}</span>
      {meta && <span className="block text-xs font-medium text-blue-700 mt-1">{meta}</span>}
    </span>
  </label>
);

/** Export dialog: rows = current filters | all data; view = users | transactions. The server builds the file. */
const ExportCsvDialog = ({ open, filters, filterLabels, view: pageView, exporting, onClose, onDownload }) => {
  const activeCount = countFilters(filters);
  const [scope, setScope] = useState('filtered');
  const [view, setView] = useState('users');
  const [who, setWho] = useState('everyone'); // everyone | referred
  const [count, setCount] = useState(null);
  const firstRadio = useRef(null);
  const countReq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setScope(activeCount ? 'filtered' : 'all');
    setView(pageView);
    setWho(filters.includeDirect === false ? 'referred' : 'everyone');
    setTimeout(() => firstRadio.current?.focus(), 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const effective = useMemo(() => ({ ...(scope === 'all' ? {} : toQuery(filters)), includeDirect: who === 'referred' ? '0' : undefined, view }), [scope, view, who, filters]);

  useEffect(() => {
    if (!open) return undefined;
    const reqId = ++countReq.current;
    let cancelled = false;
    setCount(null);
    fetchUsersPlans({ page: 1, pageSize: 1, ...effective })
      .then((r) => { if (!cancelled && reqId === countReq.current) setCount(Number(r.data?.total) || 0); })
      .catch(() => { if (!cancelled && reqId === countReq.current) setCount(0); });
    return () => { cancelled = true; };
  }, [open, effective]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !exporting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, exporting, onClose]);

  if (!open) return null;
  const countText = count === null ? 'Counting…' : `${fmtNum(count)} row${count !== 1 ? 's' : ''}`;
  const legend = 'text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !exporting) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 id="export-title" className="text-lg font-bold text-slate-800 leading-tight">Export to CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">Generated by the server. Opens in Excel or Google Sheets. Amounts in INR, dates in IST.</p>
          </div>
          <button type="button" onClick={onClose} disabled={exporting} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          <fieldset>
            <legend className={legend}>What to export</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <OptionCard inputRef={firstRadio} name="export-view" value="users" checked={view === 'users'} onChange={setView} title="Users" help="One row per user with the latest paid plan payment, GST breakup, invoice and Razorpay references." meta={view === 'users' ? countText : null} />
              <OptionCard name="export-view" value="transactions" checked={view === 'transactions'} onChange={setView} title="Transactions" help="One row per paid plan payment, so repeat purchases are listed separately." meta={view === 'transactions' ? countText : null} />
            </div>
          </fieldset>
          <fieldset>
            <legend className={legend}>Rows</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <OptionCard name="export-scope" value="filtered" checked={scope === 'filtered'} onChange={setScope} title="Current filters" help={activeCount ? `${activeCount} filter${activeCount > 1 ? 's' : ''} applied on the table.` : 'No filters applied right now.'} />
              <OptionCard name="export-scope" value="all" checked={scope === 'all'} onChange={setScope} title="All data" help="Every row, ignoring the table filters." />
            </div>
            {scope === 'filtered' && filterLabels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {filterLabels.map((l) => <span key={l} className="inline-flex items-center h-5 px-1.5 rounded bg-white border border-blue-200 text-[11px] font-medium text-blue-700">{l}</span>)}
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend className={legend}>Users to include</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <OptionCard name="export-who" value="everyone" checked={who === 'everyone'} onChange={setWho} title="Include direct" help="Referred users plus direct sign-ups that have no referral code." />
              <OptionCard name="export-who" value="referred" checked={who === 'referred'} onChange={setWho} title="Referred only" help="Only users who registered through a sales owner's referral code." />
            </div>
          </fieldset>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">File name and columns are set by the server (Username … Invoice Number, Razorpay Payment ID, Order ID, Receipt).</span>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 tabular-nums"><Users className="w-3.5 h-3.5" /> {count === null ? '…' : `${fmtNum(count)} row${count !== 1 ? 's' : ''}`}</span>
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={onClose} disabled={exporting} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => onDownload(effective)} disabled={exporting || count === null || count === 0} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} /> {exporting ? 'Preparing…' : 'Download CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FinanceSubscribers = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [view, setView] = useState('users');
  const [sortBy, setSortBy] = useState('purchase_date'); // latest payment first; users without payments at the bottom
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState({ tiers: PLAN_OPTIONS, topupPlans: [], salesOwners: [], ownerTypes: OWNER_TYPES, userStatuses: USER_STATUSES });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const reqIdRef = useRef(0);
  const { toasts, toast, dismiss } = useToasts();
  const [assignFor, setAssignFor] = useState(null); // row whose referral code the admin is assigning / changing

  const setFilter = useCallback((patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); }, []);

  // Debounced text inputs
  useEffect(() => {
    const t = setTimeout(() => { const v = searchInput.trim(); setFilters((f) => (f.search === v ? f : (setPage(1), { ...f, search: v }))); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => {
    const t = setTimeout(() => { const v = codeInput.trim(); setFilters((f) => (f.code === v ? f : (setPage(1), { ...f, code: v }))); }, 300);
    return () => clearTimeout(t);
  }, [codeInput]);

  const sortable = view === 'transactions' ? TX_SORT : USER_SORT;
  useEffect(() => {
    // Keep the sort valid when the view changes.
    if (!sortable.includes(sortBy)) { setSortBy('purchase_date'); setSortDir('desc'); }
  }, [view, sortBy, sortable]);

  const query = useMemo(() => ({ ...toQuery(filters), view, sortBy, sortDir }), [filters, view, sortBy, sortDir]);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setErr(null);
    const startedAt = Date.now();
    const params = { page, pageSize, ...query };
    log.event('list:load:start', { role: localStorage.getItem('userRole'), ...params });
    try {
      const r = await fetchUsersPlans(params);
      if (reqId !== reqIdRef.current) return;
      const data = r.data || {};
      const list = Array.isArray(data.rows) ? data.rows : [];
      setRows(list);
      setTotal(Number(data.total) || 0);
      const f = data.filters || {};
      setFacets({
        tiers: Array.isArray(f.tiers) && f.tiers.length ? f.tiers : PLAN_OPTIONS,
        topupPlans: Array.isArray(f.topupPlans) ? f.topupPlans : [],
        salesOwners: Array.isArray(f.salesOwners) ? f.salesOwners : [],
        ownerTypes: Array.isArray(f.ownerTypes) && f.ownerTypes.length ? f.ownerTypes : OWNER_TYPES,
        userStatuses: Array.isArray(f.userStatuses) && f.userStatuses.length ? f.userStatuses : USER_STATUSES,
      });
      log.flow('list:load:success', {
        summary: { total: data.total, page, pageSize, view, sortBy, sortDir, rowCount: list.length },
        table: list.slice(0, 8).map((row) => ({ user_id: row.user_id, email: row.email, plan: row.plan_name, owner: row.sales_owner?.name, status: row.user_status })),
        metrics: { durationMs: Date.now() - startedAt },
      });
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      log.error('list:load:failed', e, { summary: params });
      setErr(e.message || 'Failed to load users');
      setRows([]);
      setTotal(0);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [page, pageSize, query, view, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
    if (page > maxPage) setPage(maxPage);
  }, [page, pageSize, total]);

  const activeCount = countFilters(filters);
  const hasFilters = activeCount > 0;
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setSearchInput(''); setCodeInput(''); setPage(1); };
  const handleRefresh = () => { if (!hasFilters && !searchInput && !codeInput) load(); else resetFilters(); };

  const toggleSort = (field) => {
    if (!sortable.includes(field)) return;
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortDir(field === 'username' || field === 'email' || field === 'plan' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const activePreset = DATE_PRESETS.find((p) => { const [a, b] = p.range(); return a === filters.fromDate && b === filters.toDate; })?.key;
  const rangeLabel = filters.fromDate && filters.toDate
    ? (filters.fromDate === filters.toDate ? fmtYmd(filters.fromDate) : `${fmtYmd(filters.fromDate)} – ${fmtYmd(filters.toDate)}`)
    : filters.fromDate ? `From ${fmtYmd(filters.fromDate)}` : filters.toDate ? `Until ${fmtYmd(filters.toDate)}` : '';
  const planLabel = (key) => facets.tiers.find((t) => t.key === key)?.label || PLAN_OPTIONS.find((t) => t.key === key)?.label || key;

  const chips = useMemo(() => {
    const out = [];
    const f = filters;
    if (f.search) out.push({ key: 'search', label: `Search: ${f.search}`, clear: () => { setSearchInput(''); setFilter({ search: '' }); } });
    if (f.plan) out.push({ key: 'plan', label: planLabel(f.plan), clear: () => setFilter({ plan: '' }) });
    if (f.topupPlanId) out.push({ key: 'topup', label: `Top-up: ${facets.topupPlans.find((p) => String(p.id) === String(f.topupPlanId))?.name || f.topupPlanId}`, clear: () => setFilter({ topupPlanId: '' }) });
    if (f.ownerType) out.push({ key: 'ownerType', label: `Owner type: ${titleCase(f.ownerType)}`, clear: () => setFilter({ ownerType: '' }) });
    if (f.includeDirect === false) out.push({ key: 'direct', label: 'Referred users only', clear: () => setFilter({ includeDirect: true }) });
    if (f.ownerId) out.push({ key: 'owner', label: `Sales owner: ${facets.salesOwners.find((o) => String(o.id) === String(f.ownerId))?.name || '…'}`, clear: () => setFilter({ ownerId: '' }) });
    if (f.code) out.push({ key: 'code', label: `Code: ${f.code}`, clear: () => { setCodeInput(''); setFilter({ code: '' }); } });
    if (f.userStatus) out.push({ key: 'userStatus', label: `Status: ${titleCase(f.userStatus)}`, clear: () => setFilter({ userStatus: '' }) });
    if (rangeLabel) out.push({ key: 'date', label: `Purchased (IST): ${rangeLabel}`, clear: () => setFilter({ fromDate: '', toDate: '' }) });
    return out;
  }, [filters, facets, rangeLabel, setFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadCsv = async (params) => {
    setExporting(true);
    log.event('csv:start', params);
    try {
      const { blob, filename } = await downloadUsersPlansCsv(params);
      saveBlob(blob, filename);
      toast('success', 'CSV downloaded', filename);
      setExportOpen(false);
    } catch (e) {
      log.error('csv:failed', e, { summary: params });
      toast('error', 'Export failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDoc = async (row, pay, doc) => {
    if (!pay?.payment_id) return;
    const key = `${row.user_id}-${pay.payment_id}-${doc}`;
    setBusyKey(key);
    log.event(`${doc}:download:start`, { user_id: row.user_id, payment_id: pay.payment_id });
    try {
      const { blob, filename } = await downloadUsersPlanDocument(row.user_id, pay.payment_id, doc);
      saveBlob(blob, filename);
    } catch (e) {
      log.error(`${doc}:download:failed`, e, { summary: { user_id: row.user_id, payment_id: pay.payment_id, code: e.code } });
      if (e.code === 'NO_INVOICE') toast('info', 'No invoice for this payment', e.message);
      else toast('error', `Could not download ${doc}`, e.message);
    } finally {
      setBusyKey(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 || rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = rows.length === 0 ? 0 : from + rows.length - 1;
  const pages = useMemo(() => pageNumbers(page, pageCount), [page, pageCount]);
  const isTx = view === 'transactions';

  const Th = ({ field, children, align = 'left', className = '' }) => {
    const can = field && sortable.includes(field);
    const active = can && sortBy === field;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th className={`px-2 py-2 font-semibold border-b border-slate-200 whitespace-nowrap overflow-hidden ${align === 'right' ? 'text-right' : 'text-left'} ${className}`} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
        {can ? (
          <button type="button" onClick={() => toggleSort(field)} className={`inline-flex items-center gap-1 hover:text-blue-700 ${active ? 'text-blue-700' : ''}`} title={`Sort by ${children}`}>
            {children} <Icon className={`w-3 h-3 ${active ? '' : 'opacity-40'}`} />
          </button>
        ) : children}
      </th>
    );
  };

  const td = 'px-2 py-2 border-b border-slate-100 align-middle overflow-hidden';
  const numCls = 'text-right tabular-nums whitespace-nowrap text-xs';

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-2.5 min-h-0">
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shrink-0"><Users className="w-4 h-4 text-white" /></div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Users & Plans</h1>
            <p className="text-xs text-slate-500 truncate">Every user with sales attribution, plan, GST breakup, invoice and Razorpay references. Dates are IST; the purchase-date range includes the end date.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="View">
            {[['users', 'Users'], ['transactions', 'Transactions']].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => { setView(k); setPage(1); }}
                className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors ${view === k ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setExportOpen(true)} disabled={exporting} className={btnClass} title="Export CSV (current filters or all data)">
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} /> {exporting ? 'Preparing…' : 'Download CSV'}
          </button>
          <button type="button" onClick={handleRefresh} className={btnClass} title={hasFilters ? 'Clear filters and reload' : 'Reload'}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 px-3 py-2 border-b border-slate-100 flex flex-wrap items-center gap-1.5">
          <div className="relative w-48 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name, email or id" className={`${fieldClass} w-full pl-8`} aria-label="Search" />
          </div>
          <select value={filters.plan} onChange={(e) => setFilter({ plan: e.target.value })} className={`${fieldClass} w-[8.5rem] ${filters.plan ? activeFieldClass : 'text-slate-400'}`} aria-label="Plan">
            <option value="">All plans</option>
            {facets.tiers.map((p) => <option key={p.key} value={p.key} className="text-slate-700">{p.label}{p.count != null ? ` (${fmtNum(p.count)})` : ''}</option>)}
          </select>
          <select value={filters.topupPlanId} onChange={(e) => setFilter({ topupPlanId: e.target.value })} className={`${fieldClass} w-[9.5rem] ${filters.topupPlanId ? activeFieldClass : 'text-slate-400'}`} aria-label="Top-up plan">
            <option value="">All top-up plans</option>
            {facets.topupPlans.map((p) => <option key={p.id} value={p.id} className="text-slate-700">{p.name}</option>)}
          </select>
          <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />
          <select value={filters.ownerType} onChange={(e) => setFilter({ ownerType: e.target.value })} className={`${fieldClass} w-[9rem] ${filters.ownerType ? activeFieldClass : 'text-slate-400'}`} aria-label="Owner type">
            <option value="">All owner types</option>
            {facets.ownerTypes.map((t) => <option key={t} value={t} className="text-slate-700" disabled={t === 'DIRECT' && filters.includeDirect === false}>{titleCase(t)}</option>)}
          </select>
          <label
            className={`inline-flex items-center gap-2 h-9 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer select-none shrink-0 transition-colors ${
              filters.includeDirect === false ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title={filters.includeDirect === false ? 'Showing only users who signed up through a referral code' : 'Showing every user, including direct sign-ups with no referral code'}
          >
            <button
              type="button"
              role="switch"
              aria-checked={filters.includeDirect !== false}
              onClick={() => { const next = filters.includeDirect === false; setFilter({ includeDirect: next, ownerType: !next && filters.ownerType === 'DIRECT' ? '' : filters.ownerType }); }}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${filters.includeDirect !== false ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${filters.includeDirect !== false ? 'translate-x-4' : ''}`} />
            </button>
            {filters.includeDirect !== false ? 'Include direct' : 'Referred only'}
          </label>
          <select value={filters.ownerId} onChange={(e) => setFilter({ ownerId: e.target.value })} className={`${fieldClass} w-[10.5rem] ${filters.ownerId ? activeFieldClass : 'text-slate-400'}`} aria-label="Sales owner">
            <option value="">All sales owners</option>
            {facets.salesOwners.map((o) => <option key={o.id} value={o.id} className="text-slate-700">{o.name}{o.type ? ` (${titleCase(o.type)})` : ''}</option>)}
          </select>
          <input type="search" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Referral code" className={`${fieldClass} w-[8.5rem] ${filters.code ? activeFieldClass : ''}`} aria-label="Referral code" />
          <select value={filters.userStatus} onChange={(e) => setFilter({ userStatus: e.target.value })} className={`${fieldClass} w-[8.5rem] ${filters.userStatus ? activeFieldClass : 'text-slate-400'}`} aria-label="User status">
            <option value="">All statuses</option>
            {facets.userStatuses.map((s) => <option key={s} value={s} className="text-slate-700">{titleCase(s)}</option>)}
          </select>
          <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />
          <span className="text-xs font-semibold text-slate-500 shrink-0" title="IST calendar days; the end date is included">Purchased (IST)</span>
          <input type="date" value={filters.fromDate} max={filters.toDate || undefined} onChange={(e) => setFilter({ fromDate: e.target.value })} className={`${fieldClass} w-[9.5rem] ${filters.fromDate ? activeFieldClass : ''}`} aria-label="Purchased from (IST)" title="From (IST)" />
          <span className="text-xs text-slate-400 shrink-0">to</span>
          <input type="date" value={filters.toDate} min={filters.fromDate || undefined} onChange={(e) => setFilter({ toDate: e.target.value })} className={`${fieldClass} w-[9.5rem] ${filters.toDate ? activeFieldClass : ''}`} aria-label="Purchased to (IST, inclusive)" title="To (IST, inclusive)" />
          <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
            {DATE_PRESETS.map((preset) => (
              <button key={preset.key} type="button" onClick={() => { const [a, b] = preset.range(); setFilter({ fromDate: a, toDate: b }); }}
                className={`h-8 px-2.5 rounded-md text-xs font-semibold transition-colors ${activePreset === preset.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {preset.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shrink-0"><X className="w-3 h-3" /> Reset</button>
          )}
          <span className="ml-auto pl-2 text-xs text-slate-400 whitespace-nowrap shrink-0">
            {loading ? 'Loading…' : `${fmtNum(total)} ${isTx ? 'payment' : 'user'}${total !== 1 ? 's' : ''}${hasFilters ? ' matching' : ''}`}
          </span>
        </div>
        {chips.length > 0 && (
          <div className="shrink-0 px-3 py-1.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">All of</span>
            {chips.map((chip, i) => (
              <span key={chip.key} className="inline-flex items-center gap-1 shrink-0">
                {i > 0 && <span className="text-[11px] font-semibold text-slate-400">+</span>}
                <button type="button" onClick={chip.clear} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-white border border-blue-200 text-xs font-medium text-blue-700 hover:bg-blue-50" title="Remove this filter">
                  {chip.label} <X className="w-3 h-3 text-slate-400" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          {err ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 px-4">
              <AlertTriangle className="w-8 h-8 opacity-40" />
              <p className="text-sm text-slate-600">{err}</p>
              <button type="button" onClick={load} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Retry</button>
            </div>
          ) : loading && rows.length === 0 ? (
            <div className="p-3 space-y-2 animate-pulse">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-md" />)}</div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <Users className="w-8 h-8 opacity-30" />
              <p className="text-sm">{hasFilters ? `No ${isTx ? 'payments' : 'users'} match all selected filters.` : isTx ? 'No paid plan payments yet.' : 'No users yet.'}</p>
            </div>
          ) : (
            <table className="w-full table-fixed text-[13px] border-separate border-spacing-0">
              {/* Fixed percentage widths so the whole table fits the viewport — no horizontal scrollbar. */}
              <colgroup>
                {[15, 8, 7, 6, 5.5, 4.5, 4.5, 4.5, 4.5, 6, 6.5, 9.5, 10, ...(isTx ? [6] : []), 8.5].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider">
                  <Th field="username" className="pl-4">User</Th>
                  <Th field="sales_owner">Sales owner</Th>
                  <Th>Code</Th>
                  <Th field="user_status">Status</Th>
                  <Th field="plan">Plan</Th>
                  <Th align="right">Basic</Th>
                  <Th align="right">CGST</Th>
                  <Th align="right">SGST</Th>
                  <Th align="right">IGST</Th>
                  <Th field="total_amount" align="right">Total</Th>
                  <Th field="purchase_date">Purchased</Th>
                  <Th>Invoice no.</Th>
                  <Th>Payment ID</Th>
                  {isTx && <Th field="status">Pay status</Th>}
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const pay = isTx ? r.payment : r.latest_payment;
                  const paid = Boolean(pay?.payment_id && (pay.is_paid ?? true));
                  const name = r.username || `User #${r.user_id}`;
                  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                  const key = (doc) => `${r.user_id}-${pay?.payment_id}-${doc}`;
                  const docBtn = (doc, label, Icon, enabled, title) => (
                    <button type="button" disabled={!enabled || busyKey === key(doc)} onClick={() => handleDoc(r, pay, doc)} title={title} aria-label={label}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 disabled:hover:border-slate-200">
                      {busyKey === key(doc) ? <Download className="w-4 h-4 animate-pulse" /> : <Icon className="w-4 h-4" />}
                    </button>
                  );
                  return (
                    <tr key={`${r.user_id}-${pay?.payment_id || 'none'}-${i}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className={`${td} pl-4`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">{initials || 'U'}</div>
                          <div className="flex flex-col min-w-0">
                            <button type="button" onClick={() => setDetailUserId(r.user_id)} className="font-semibold text-slate-800 flex items-center gap-1.5 truncate text-left hover:text-blue-700" title="Open details">
                              {name}{r.is_blocked && <Lock className="w-3 h-3 text-red-500 shrink-0" />}
                            </button>
                            {r.email && <span className="text-xs text-slate-500 break-all leading-tight">{r.email}</span>}
                            {!isTx && Number(r.plan_transaction_count) > 1 && (
                              <button type="button" onClick={() => setDetailUserId(r.user_id)} className="text-[11px] text-blue-600 hover:underline text-left">{fmtNum(r.plan_transaction_count)} purchases</button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <div className="flex flex-col gap-0.5">
                          <span className={`block truncate text-[13px] font-medium ${r.sales_owner ? 'text-slate-800' : 'text-slate-400'}`} title={r.sales_owner?.name || ''}>{r.sales_owner?.name || 'Direct'}</span>
                          <Pill value={r.owner_type || (r.sales_owner ? (r.sales_owner.internal ? 'INTERNAL' : 'OUTSOURCED') : 'DIRECT')} className="w-fit" />
                        </div>
                      </td>
                      <td className={td} title={r.referral?.source === 'ADMIN' ? `Assigned by admin${r.referral.set_at ? ` on ${fmtDateIST(r.referral.set_at)}` : ''}${r.referral.reason ? `: ${r.referral.reason}` : ''}` : (r.referral?.label || '')}>
                        {r.referral_code ? <Mono>{r.referral_code}</Mono> : (
                          <button type="button" onClick={() => setAssignFor(r)} className="text-[11px] font-semibold text-blue-600 hover:underline" title="This user signed up without a referral code — assign one so the sales owner gets credit">Assign code</button>
                        )}
                        {r.referral?.level === 'workspace' && <span className="block text-[10px] text-slate-400">via workspace</span>}
                        {r.referral?.source === 'ADMIN' && <span className="block text-[10px] text-violet-700 font-semibold" title={r.referral.reason || ''}>by admin{r.referral.reason ? ' · note' : ''}</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap`}><Pill value={r.user_status || 'active'} /></td>
                      <td className={`${td} whitespace-nowrap font-medium text-slate-700`}>{(isTx ? pay?.plan_name : r.plan_name) || 'Free'}</td>
                      <td className={`${td} ${numCls} text-slate-700`}>{fmtMoneyStr(pay?.basic_amount)}</td>
                      <td className={`${td} ${numCls} text-slate-600`} title={pay?.tax?.cgst_rate != null ? `CGST ${pay.tax.cgst_rate}%` : undefined}>{fmtMoneyStr(pay?.cgst_amount)}</td>
                      <td className={`${td} ${numCls} text-slate-600`} title={pay?.tax?.sgst_rate != null ? `SGST ${pay.tax.sgst_rate}%` : undefined}>{fmtMoneyStr(pay?.sgst_amount)}</td>
                      <td className={`${td} ${numCls} text-slate-600`} title={pay?.tax?.igst_rate != null ? `IGST ${pay.tax.igst_rate}%` : undefined}>{fmtMoneyStr(pay?.igst_amount)}</td>
                      <td className={`${td} ${numCls} font-semibold text-slate-800`} title={pay?.tax ? `${pay.tax.type || ''} ${pay.tax.basis ? `(${pay.tax.basis})` : ''}`.trim() : undefined}>
                        {fmtMoneyStr(pay?.total_amount)}
                        {pay?.amount_refunded && pay.amount_refunded !== '0.00' && <span className="block text-[10px] font-normal text-violet-700">refunded {fmtMoneyStr(pay.amount_refunded)}</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-slate-600`} title={pay?.purchase_date ? fmtDateTimeIST(pay.purchase_date) : undefined}>{pay?.purchase_date ? fmtDateIST(pay.purchase_date) : <span className="text-slate-400">—</span>}</td>
                      <td className={td}>{pay?.invoice_number ? <Mono>{pay.invoice_number}</Mono> : <span className="text-slate-400" title={paid ? 'No application invoice for this payment' : ''}>—</span>}</td>
                      <td className={td} title={pay?.razorpay_order_id ? `Razorpay order ${pay.razorpay_order_id}` : undefined}>
                        <Mono>{pay?.razorpay_payment_id}</Mono>
                        {pay?.razorpay_receipt && <span className="block text-[10px] text-slate-400 font-mono break-all" title="Razorpay receipt">{pay.razorpay_receipt}</span>}
                      </td>
                      {isTx && <td className={`${td} whitespace-nowrap`}><span className={`inline-flex h-5 px-1.5 rounded border text-[10px] font-semibold uppercase ${paid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{pay?.status || '—'}</span></td>}
                      <td className={td}>
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {paid ? (
                            <>
                              {docBtn('invoice', 'Invoice', FileText, Boolean(pay.invoice_number), pay.invoice_number ? 'Download tax invoice (PDF)' : 'No application invoice exists for this payment')}
                              {docBtn('receipt', 'Receipt', ReceiptText, true, 'Download payment receipt (PDF)')}
                            </>
                          ) : <span className="text-xs text-slate-400 mr-1" title="No payments">—</span>}
                          {!r.referral_code && (
                            <button type="button" onClick={() => setAssignFor(r)} aria-label="Assign referral code" className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 shadow-sm hover:bg-violet-100 hover:border-violet-300 transition-colors" title="Direct signup — assign a referral code so the sales owner gets credit">
                              <Tag className="w-4 h-4" />
                            </button>
                          )}
                          <button type="button" onClick={() => setDetailUserId(r.user_id)} aria-label="Details" className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 hover:border-blue-300 transition-colors" title="View details (full history)">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Rows per page
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500" aria-label="Rows per page">
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-500">{total === 0 ? 'No results' : `Showing ${fmtNum(from)}–${fmtNum(to)} of ${fmtNum(total)}`}</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /> Prev</button>
            {pages.map((n, i) => (n === '…'
              ? <span key={`e-${i}`} className="px-1 text-xs text-slate-400">…</span>
              : <button key={n} type="button" disabled={loading} onClick={() => setPage(n)} className={`h-8 min-w-[2rem] px-2 rounded-md text-xs font-semibold border transition-colors ${n === page ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{n}</button>))}
            <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      <ExportCsvDialog open={exportOpen} filters={filters} filterLabels={chips.map((c) => c.label)} view={view} exporting={exporting} onClose={() => setExportOpen(false)} onDownload={handleDownloadCsv} />
      {detailUserId != null && <UserPlanDetailDrawer userId={detailUserId} onClose={() => setDetailUserId(null)} onToast={toast} />}
      {/* Assign / change the referral attribution of a direct-signup user (A16: firm workspace when the user has one, else the user). */}
      <SetWorkspaceReferralDialog
        open={Boolean(assignFor)}
        onClose={() => setAssignFor(null)}
        workspace={assignFor ? {
          tenantId: assignFor.firm_id || String(assignFor.user_id),
          firmName: assignFor.username || assignFor.email || `User #${assignFor.user_id}`,
          referral: assignFor.referral ? { code: { code: assignFor.referral.code } } : null,
        } : null}
        onSaved={(saved) => {
          const code = saved?.referral?.code?.code;
          const owner = saved?.referral?.owner?.name;
          toast('success', `${assignFor?.username || 'User'} is now attributed to ${code || 'the selected code'}${owner ? ` (${owner})` : ''}.`);
          setAssignFor(null);
          load();
        }}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default FinanceSubscribers;
