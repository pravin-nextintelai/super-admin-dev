import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Download, Eye, Lock, RefreshCw, Search, Users, X,
} from 'lucide-react';
import { fmtDate, fmtINR, fmtNum } from './userAnalytics/analyticsFormat';
import { StatusPill } from './userAnalytics/AnalyticsCharts';
import { downloadPlanSubscribersCsv, fetchPlanSubscribers } from './userAnalytics/analyticsApi';
import { createDebugLogger } from '../../utils/debugLogger';

const financeSubscribersLogger = createDebugLogger('FinanceSubscribers');
const PAGE_SIZE = 50;

const fieldClass =
  'h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all';
const activeFieldClass = 'border-blue-400 bg-blue-50 text-blue-800 font-medium';

const nameOf = (list, id) => (list || []).find((p) => String(p.id) === String(id))?.name;
const statusLabel = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'topup_only') return 'Top-up only';
  if (v === 'pack_only') return 'Pack only';
  if (!v) return 'Status';
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

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
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState('');
  const [topupPlanId, setTopupPlanId] = useState('');
  const [addonPlanId, setAddonPlanId] = useState('');
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [plans, setPlans] = useState([]);
  const [topupPlans, setTopupPlans] = useState([]);
  const [addonPlans, setAddonPlans] = useState([]);
  const [statuses, setStatuses] = useState(['active', 'topup_only', 'pack_only']);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState(null);
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

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setErr(null);
    const startedAt = Date.now();
    const params = {
      page,
      pageSize: PAGE_SIZE,
      planId: planId || undefined,
      topupPlanId: topupPlanId || undefined,
      addonPlanId: addonPlanId || undefined,
      status: status || undefined,
      month: month || undefined,
      day: day || undefined,
      search: search || undefined,
    };
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
      setPlans(Array.isArray(data.filters?.plans) ? data.filters.plans : []);
      setTopupPlans(Array.isArray(data.filters?.topupPlans) ? data.filters.topupPlans : []);
      setAddonPlans(Array.isArray(data.filters?.addonPlans) ? data.filters.addonPlans : []);
      setStatuses(Array.isArray(data.filters?.statuses) && data.filters.statuses.length
        ? data.filters.statuses
        : ['active', 'topup_only', 'pack_only']);
      financeSubscribersLogger.flow('list:load:success', {
        summary: {
          role: localStorage.getItem('userRole'),
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          planId: planId || null,
          topupPlanId: topupPlanId || null,
          addonPlanId: addonPlanId || null,
          status: status || null,
          month: month || null,
          day: day || null,
          search: search || null,
          rowCount: list.length,
        },
        table: list.slice(0, 8).map((row) => ({
          user_id: row.user_id,
          email: row.email,
          plan_name: row.plan_name,
          status: row.status,
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
  }, [page, planId, topupPlanId, addonPlanId, status, month, day, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    if (page > maxPage) setPage(maxPage);
  }, [page, total]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setPlanId('');
    setTopupPlanId('');
    setAddonPlanId('');
    setStatus('');
    setMonth('');
    setDay('');
    setPage(1);
  };

  const handleRefresh = () => {
    const alreadyClear = !searchInput && !search && !planId && !topupPlanId && !addonPlanId && !status && !month && !day;
    resetFilters();
    if (alreadyClear) load();
  };

  const handleDownloadCsv = async () => {
    setExporting(true);
    const params = {
      planId: planId || undefined,
      topupPlanId: topupPlanId || undefined,
      addonPlanId: addonPlanId || undefined,
      status: status || undefined,
      month: month || undefined,
      day: day || undefined,
      search: search || undefined,
    };
    financeSubscribersLogger.event('csv:start', {
      role: localStorage.getItem('userRole'),
      filtered: Boolean(search || planId || topupPlanId || addonPlanId || status || month || day),
      ...params,
    });
    try {
      const { blob, filename } = await downloadPlanSubscribersCsv(params);
      const a = document.createElement('a');
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      financeSubscribersLogger.flow('csv:success', {
        summary: { filename, filtered: Boolean(search || planId || topupPlanId || addonPlanId || status || month || day) },
      });
    } catch (e) {
      financeSubscribersLogger.error('csv:failed', e, {
        summary: { role: localStorage.getItem('userRole'), ...params },
      });
      window.alert(e.message || 'Failed to download CSV');
    } finally {
      setExporting(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 || rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = rows.length === 0 ? 0 : from + rows.length - 1;
  const hasFilters = Boolean(search || planId || topupPlanId || addonPlanId || status || month || day);
  const pages = useMemo(() => pageNumbers(page, pageCount), [page, pageCount]);
  const activeChips = useMemo(() => {
    const chips = [];
    if (search) chips.push({ key: 'search', label: search, onClear: () => { setSearchInput(''); setSearch(''); setPage(1); } });
    if (planId) chips.push({ key: 'plan', label: nameOf(plans, planId) || 'Monthly', onClear: () => { setPlanId(''); setPage(1); } });
    if (topupPlanId) chips.push({ key: 'topup', label: nameOf(topupPlans, topupPlanId) || 'Top-up', onClear: () => { setTopupPlanId(''); setPage(1); } });
    if (addonPlanId) chips.push({ key: 'addon', label: nameOf(addonPlans, addonPlanId) || 'Add-on', onClear: () => { setAddonPlanId(''); setPage(1); } });
    if (status) chips.push({ key: 'status', label: statusLabel(status), onClear: () => { setStatus(''); setPage(1); } });
    if (month) chips.push({ key: 'month', label: month, onClear: () => { setMonth(''); setPage(1); } });
    if (day) chips.push({ key: 'day', label: day, onClear: () => { setDay(''); setPage(1); } });
    return chips;
  }, [search, planId, topupPlanId, addonPlanId, status, month, day, plans, topupPlans, addonPlans]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-2.5 min-h-0">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Users & Plans</h1>
            <p className="text-xs text-slate-500 truncate">Monthly, top-up, and add-on buyers. Filters stay off until you pick one.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadCsv}
            disabled={exporting || loading}
            title={hasFilters ? 'Download Excel CSV of rows matching the current filters' : 'Download Excel CSV of all buyers'}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Preparing…' : 'Download CSV'}
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
        <div className="shrink-0 px-3 py-2 border-b border-slate-100 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
          <div className="relative w-52 shrink-0">
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
            value={planId}
            onChange={(e) => { setPlanId(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[9.5rem] ${planId ? activeFieldClass : 'text-slate-400'}`}
            aria-label="Filter by monthly plan"
          >
            <option value="">Monthly plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id} className="text-slate-700">{p.name}</option>
            ))}
          </select>
          <select
            value={topupPlanId}
            onChange={(e) => { setTopupPlanId(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[9.5rem] ${topupPlanId ? activeFieldClass : 'text-slate-400'}`}
            aria-label="Filter by top-up plan"
          >
            <option value="">Top-up</option>
            {topupPlans.map((p) => (
              <option key={p.id} value={p.id} className="text-slate-700">{p.name}</option>
            ))}
          </select>
          <select
            value={addonPlanId}
            onChange={(e) => { setAddonPlanId(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[9.5rem] ${addonPlanId ? activeFieldClass : 'text-slate-400'}`}
            aria-label="Filter by add-on plan"
          >
            <option value="">Add-on</option>
            {addonPlans.map((p) => (
              <option key={p.id} value={p.id} className="text-slate-700">{p.name}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[8.5rem] ${status ? activeFieldClass : 'text-slate-400'}`}
            aria-label="Filter by status"
          >
            <option value="">Status</option>
            {statuses.map((s) => (
              <option key={s} value={s} className="text-slate-700">{statusLabel(s)}</option>
            ))}
          </select>
          <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[9.5rem] ${month ? activeFieldClass : ''}`}
            aria-label="Joined month"
            title="Joined month"
          />
          <input
            type="date"
            value={day}
            onChange={(e) => { setDay(e.target.value); setPage(1); }}
            className={`${fieldClass} w-[10rem] ${day ? activeFieldClass : ''}`}
            aria-label="Joined day"
            title="Joined day"
          />
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
              ? `${fmtNum(total)} matching all filters`
              : `${fmtNum(total)} subscriber${total !== 1 ? 's' : ''}`}
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
              <p className="text-sm">{hasFilters ? 'No subscribers match all selected filters.' : 'No plan buyers yet.'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-semibold">User</th>
                  <th className="px-3 py-2 text-left font-semibold">Plan</th>
                  <th className="px-3 py-2 text-left font-semibold">Packs</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Joined</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Paid</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Last paid</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Plan balance</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Top-up</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.user_id}-${r.plan_id}-${i}`} className="border-b border-slate-100 hover:bg-blue-50/40">
                    <td className="px-3 py-2">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5 truncate">
                          {r.username || `User #${r.user_id}`}
                          {r.is_blocked && <Lock className="w-3 h-3 text-red-500 shrink-0" />}
                        </span>
                        {r.email && <span className="text-xs text-slate-400 truncate">{r.email}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {r.plan_name || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[14rem]">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        {r.topup_plan_names ? (
                          <span className="text-xs text-slate-700 truncate" title={r.topup_plan_names}>{r.topup_plan_names}</span>
                        ) : null}
                        {r.addon_plan_names ? (
                          <span className="text-xs text-slate-500 truncate" title={r.addon_plan_names}>{r.addon_plan_names}</span>
                        ) : null}
                        {!r.topup_plan_names && !r.addon_plan_names ? <span className="text-xs text-slate-400">—</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2"><StatusPill status={r.status === 'pack_only' ? 'Pack only' : r.status} /></td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(r.joined_at || r.created_at || r.start_date)}</td>
                    <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums whitespace-nowrap">{fmtINR(r.paid_total)}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(r.last_paid_at)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{fmtNum(r.current_token_balance)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{fmtNum(r.topup_token_balance)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/dashboard/users/${r.user_id}/analytics`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Analytics
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-slate-500">
            {total === 0 ? 'No results' : `Showing ${fmtNum(from)}–${fmtNum(to)} of ${fmtNum(total)}`}
          </p>
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
