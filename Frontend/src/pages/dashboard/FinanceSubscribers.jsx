import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Lock, ReceiptText, RefreshCw, Search, Users, X,
} from 'lucide-react';
import { fmtDate, fmtINR, fmtNum } from './userAnalytics/analyticsFormat';
import { downloadPlanSubscribersCsv, downloadSubscriberDocument, fetchPlanSubscribers } from './userAnalytics/analyticsApi';
import { createDebugLogger } from '../../utils/debugLogger';

const financeSubscribersLogger = createDebugLogger('FinanceSubscribers');
const PAGE_SIZE_OPTIONS = [10, 50, 100];
const PLAN_OPTIONS = [
  { key: 'free', label: 'Free' },
  { key: 'pro', label: 'Pro' },
  { key: 'plus', label: 'Plus' },
  { key: 'lite', label: 'Lite' },
  { key: 'enterprise', label: 'Enterprise' },
];

const fieldClass =
  'h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all';
const activeFieldClass = 'border-blue-400 bg-blue-50 text-blue-800 font-medium';

const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DATE_PRESETS = [
  { key: 'today', label: 'Today', range: () => { const t = isoDay(new Date()); return [t, t]; } },
  {
    key: 'this-month',
    label: 'This month',
    range: () => { const n = new Date(); return [isoDay(new Date(n.getFullYear(), n.getMonth(), 1)), isoDay(n)]; },
  },
  {
    key: 'last-month',
    label: 'Last month',
    range: () => {
      const n = new Date();
      return [isoDay(new Date(n.getFullYear(), n.getMonth() - 1, 1)), isoDay(new Date(n.getFullYear(), n.getMonth(), 0))];
    },
  },
];
const fmtRangeDay = (v) => (v ? fmtDate(`${v}T00:00:00`) : '');

function pageNumbers(current, total) {
  if (total <= 1) return [1];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

const FinanceSubscribers = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [tiers, setTiers] = useState(PLAN_OPTIONS);
  const [topupPlanId, setTopupPlanId] = useState('');
  const [topupPlans, setTopupPlans] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      setSearch((prev) => {
        if (prev === next) return prev;
        setPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filterParams = useMemo(() => ({
    plan: plan || undefined,
    topupPlanId: topupPlanId || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    search: search || undefined,
  }), [plan, topupPlanId, fromDate, toDate, search]);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setErr(null);
    const startedAt = Date.now();
    const params = { page, pageSize, ...filterParams };
    financeSubscribersLogger.event('list:load:start', {
      role: localStorage.getItem('userRole'),
      ...params,
    });
    try {
      const r = await fetchPlanSubscribers(params);
      if (reqId !== reqIdRef.current) return;
      const data = r.data || {};
      const list = Array.isArray(data.rows) ? data.rows : [];
      setRows(list);
      setTotal(Number(data.total) || 0);
      setTiers(Array.isArray(data.filters?.tiers) && data.filters.tiers.length ? data.filters.tiers : PLAN_OPTIONS);
      setTopupPlans(Array.isArray(data.filters?.topupPlans) ? data.filters.topupPlans : []);
      financeSubscribersLogger.flow('list:load:success', {
        summary: {
          role: localStorage.getItem('userRole'),
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          ...filterParams,
          rowCount: list.length,
        },
        table: list.slice(0, 8).map((row) => ({
          user_id: row.user_id,
          email: row.email,
          plan_name: row.plan_name,
        })),
        metrics: { durationMs: Date.now() - startedAt },
      });
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      financeSubscribersLogger.error('list:load:failed', e, {
        summary: { role: localStorage.getItem('userRole'), ...params },
      });
      setErr(e.message || 'Failed to load subscribers');
      setRows([]);
      setTotal(0);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [page, pageSize, filterParams]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
    if (page > maxPage) setPage(maxPage);
  }, [page, pageSize, total]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setPlan('');
    setTopupPlanId('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasFilters = Boolean(search || plan || topupPlanId || fromDate || toDate);

  const handleRefresh = () => {
    const alreadyClear = !searchInput && !hasFilters;
    resetFilters();
    if (alreadyClear) load();
  };

  const applyPreset = (preset) => {
    const [f, t] = preset.range();
    setFromDate(f);
    setToDate(t);
    setPage(1);
  };
  const activePreset = DATE_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === fromDate && t === toDate;
  })?.key;

  const handleDownloadCsv = async () => {
    setExporting(true);
    financeSubscribersLogger.event('csv:start', {
      role: localStorage.getItem('userRole'),
      filtered: hasFilters,
      ...filterParams,
    });
    try {
      const { blob, filename } = await downloadPlanSubscribersCsv(filterParams);
      const a = document.createElement('a');
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      financeSubscribersLogger.flow('csv:success', { summary: { filename, filtered: hasFilters } });
    } catch (e) {
      financeSubscribersLogger.error('csv:failed', e, {
        summary: { role: localStorage.getItem('userRole'), ...filterParams },
      });
      window.alert(e.message || 'Failed to download CSV');
    } finally {
      setExporting(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 || rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = rows.length === 0 ? 0 : from + rows.length - 1;
  const pages = useMemo(() => pageNumbers(page, pageCount), [page, pageCount]);
  const planLabel = (key) => (tiers.find((t) => t.key === key)?.label) || PLAN_OPTIONS.find((t) => t.key === key)?.label || key;
  const rangeLabel = fromDate && toDate
    ? (fromDate === toDate ? fmtRangeDay(fromDate) : `${fmtRangeDay(fromDate)} – ${fmtRangeDay(toDate)}`)
    : fromDate ? `From ${fmtRangeDay(fromDate)}` : toDate ? `Until ${fmtRangeDay(toDate)}` : '';
  const activeChips = useMemo(() => {
    const chips = [];
    if (search) chips.push({ key: 'search', label: search, onClear: () => { setSearchInput(''); setSearch(''); setPage(1); } });
    if (plan) chips.push({ key: 'plan', label: planLabel(plan), onClear: () => { setPlan(''); setPage(1); } });
    if (topupPlanId) {
      const name = topupPlans.find((p) => String(p.id) === String(topupPlanId))?.name || 'Top-up';
      chips.push({ key: 'topup', label: `Top-up: ${name}`, onClear: () => { setTopupPlanId(''); setPage(1); } });
    }
    if (rangeLabel) chips.push({ key: 'date', label: `Purchased: ${rangeLabel}`, onClear: () => { setFromDate(''); setToDate(''); setPage(1); } });
    return chips;
  }, [search, plan, topupPlanId, topupPlans, rangeLabel, tiers]);

  const handleDownloadDoc = async (row, doc) => {
    const paymentId = row.latest_invoice_id;
    if (!paymentId) return;
    const key = `${row.user_id}-${paymentId}-${doc}`;
    setDownloadingKey(key);
    financeSubscribersLogger.event(`${doc}:download:start`, { user_id: row.user_id, payment_id: paymentId });
    try {
      const { blob, filename } = await downloadSubscriberDocument(row.user_id, paymentId, doc);
      const a = document.createElement('a');
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      financeSubscribersLogger.error(`${doc}:download:failed`, e, { summary: { user_id: row.user_id, payment_id: paymentId } });
      window.alert(e.message || `Failed to download ${doc}`);
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-2.5 min-h-0">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Users & Plans</h1>
            <p className="text-xs text-slate-500 truncate">Every user, their plan, invoices, and receipts. Free, Pro, Plus, Lite, and Enterprise.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadCsv}
            disabled={exporting || loading}
            title={rangeLabel ? `Download CSV of purchases: ${rangeLabel}` : hasFilters ? 'Download CSV of users matching the current filters' : 'Download CSV of all users'}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Preparing…' : rangeLabel ? `Download CSV (${rangeLabel})` : 'Download CSV'}
          </button>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 px-3 py-2 border-b border-slate-100 flex flex-wrap items-center gap-1.5">
          <div className="relative w-48 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name or email"
              className={`${fieldClass} w-full pl-8`}
            />
          </div>
          <select
            value={plan}
            onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[9rem] ${plan ? activeFieldClass : 'text-slate-400'}`}
            aria-label="Filter by plan"
          >
            <option value="">All plans</option>
            {tiers.map((p) => (
              <option key={p.key} value={p.key} className="text-slate-700">
                {p.label}{p.count != null ? ` (${fmtNum(p.count)})` : ''}
              </option>
            ))}
          </select>
          <select
            value={topupPlanId}
            onChange={(e) => { setTopupPlanId(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[10rem] ${topupPlanId ? activeFieldClass : 'text-slate-400'}`}
            aria-label="Filter by top-up plan"
          >
            <option value="">All top-up plans</option>
            {topupPlans.map((p) => (
              <option key={p.id} value={p.id} className="text-slate-700">{p.name}</option>
            ))}
          </select>
          <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />
          <span className="text-xs font-semibold text-slate-500 shrink-0">Purchased</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[9.5rem] ${fromDate ? activeFieldClass : ''}`}
            aria-label="Purchased from"
            title="Purchased from"
          />
          <span className="text-xs text-slate-400 shrink-0">to</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[9.5rem] ${toDate ? activeFieldClass : ''}`}
            aria-label="Purchased to"
            title="Purchased to"
          />
          <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`h-8 px-2.5 rounded-md text-xs font-semibold transition-colors ${
                  activePreset === preset.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shrink-0"
            >
              <X className="w-3 h-3" /> Reset
            </button>
          )}
          <span className="ml-auto pl-2 text-xs text-slate-400 whitespace-nowrap shrink-0">
            {loading ? 'Loading…' : hasFilters
              ? `${fmtNum(total)} matching`
              : `${fmtNum(total)} user${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        {activeChips.length > 0 && (
          <div className="shrink-0 px-3 py-1.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">All of</span>
            {activeChips.map((chip, i) => (
              <span key={chip.key} className="inline-flex items-center gap-1 shrink-0">
                {i > 0 && <span className="text-[11px] font-semibold text-slate-400">+</span>}
                <button
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-white border border-blue-200 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  title="Remove this filter"
                >
                  {chip.label}
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          {err ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 px-4">
              <AlertTriangle className="w-8 h-8 opacity-40" />
              <p className="text-sm">{err}</p>
              <button onClick={load} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Retry</button>
            </div>
          ) : loading && rows.length === 0 ? (
            <div className="p-3 space-y-2 animate-pulse">
              {[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-md" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <Users className="w-8 h-8 opacity-30" />
              <p className="text-sm">{hasFilters ? 'No users match all selected filters.' : 'No users yet.'}</p>
            </div>
          ) : (
            <table className="w-full min-w-[56rem] text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-semibold border-b border-slate-200">User</th>
                  <th className="px-4 py-3 text-left font-semibold border-b border-slate-200 w-[12rem]">Plan</th>
                  <th className="px-4 py-3 text-right font-semibold border-b border-slate-200 w-[9rem] whitespace-nowrap">Amount paid</th>
                  <th className="px-4 py-3 text-left font-semibold border-b border-slate-200 w-[10rem] whitespace-nowrap">Purchase date</th>
                  <th className="px-4 py-3 text-right font-semibold border-b border-slate-200 w-[15rem]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const paymentId = r.latest_invoice_id;
                  const isPaid = Boolean(paymentId);
                  const name = r.username || `User #${r.user_id}`;
                  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                  const docBtn = (doc, label, icon) => {
                    const key = `${r.user_id}-${paymentId}-${doc}`;
                    const busy = downloadingKey === key;
                    return (
                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(r, doc)}
                        disabled={busy}
                        title={`Download ${label.toLowerCase()} (PDF)`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60"
                      >
                        {busy ? <Download className="w-3.5 h-3.5 animate-pulse" /> : icon}
                        {busy ? 'Preparing…' : label}
                      </button>
                    );
                  };
                  return (
                    <tr key={`${r.user_id}-${i}`} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {initials || 'U'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                              {name}
                              {r.is_blocked && <Lock className="w-3 h-3 text-red-500 shrink-0" />}
                            </span>
                            {r.email && <span className="text-xs text-slate-500 truncate">{r.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap font-medium text-slate-700">
                        {r.plan_name || 'Free'}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 text-right tabular-nums whitespace-nowrap font-semibold text-slate-800">
                        {fmtINR(isPaid ? r.latest_invoice_amount : 0)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap text-slate-600">
                        {isPaid ? fmtDate(r.latest_invoice_at) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">
                        {isPaid ? (
                          <div className="flex items-center justify-end gap-2">
                            {docBtn('invoice', 'Invoice', <FileText className="w-3.5 h-3.5" />)}
                            {docBtn('receipt', 'Receipt', <ReceiptText className="w-3.5 h-3.5" />)}
                          </div>
                        ) : (
                          <div className="text-right text-xs text-slate-400">No payments</div>
                        )}
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
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-500">
              {total === 0 ? 'No results' : `Showing ${fmtNum(from)}–${fmtNum(to)} of ${fmtNum(total)}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            {pages.map((n, i) => (
              n === '…' ? (
                <span key={`e-${i}`} className="px-1 text-xs text-slate-400">…</span>
              ) : (
                <button
                  key={n}
                  disabled={loading}
                  onClick={() => setPage(n)}
                  className={`h-8 min-w-[2rem] px-2 rounded-md text-xs font-semibold border transition-colors ${
                    n === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {n}
                </button>
              )
            ))}
            <button
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FinanceSubscribers;
