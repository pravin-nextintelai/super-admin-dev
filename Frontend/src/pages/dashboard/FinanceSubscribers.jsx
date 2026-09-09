import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Eye, Lock, RefreshCw, Search, Users, X,
} from 'lucide-react';
import { fmtDate, fmtNum } from './userAnalytics/analyticsFormat';
import { StatusPill } from './userAnalytics/AnalyticsCharts';
import { fetchPlanSubscribers } from './userAnalytics/analyticsApi';
import { createDebugLogger } from '../../utils/debugLogger';

const financeSubscribersLogger = createDebugLogger('FinanceSubscribers');
const PAGE_SIZE = 10;

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all';

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
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

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
    setLoading(true);
    setErr(null);
    const startedAt = Date.now();
    const params = {
      page,
      pageSize: PAGE_SIZE,
      planId: planId || undefined,
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
      const data = r.data || {};
      const list = Array.isArray(data.rows) ? data.rows : [];
      setRows(list);
      setTotal(Number(data.total) || 0);
      setPlans(Array.isArray(data.filters?.plans) ? data.filters.plans : []);
      financeSubscribersLogger.flow('list:load:success', {
        summary: {
          role: localStorage.getItem('userRole'),
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          planId: planId || null,
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
      financeSubscribersLogger.error('list:load:failed', e, {
        summary: { role: localStorage.getItem('userRole'), ...params },
      });
      setErr(e.message || 'Failed to load subscribers');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, planId, month, day, search]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setPlanId('');
    setMonth('');
    setDay('');
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasFilters = Boolean(search || planId || month || day);
  const pages = useMemo(() => pageNumbers(page, pageCount), [page, pageCount]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-2.5 min-h-0">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Users & Plans</h1>
            <p className="text-xs text-slate-500 truncate">Monthly-plan subscribers — search, then filter by plan or join date.</p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 px-3 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or email"
              className={`${fieldClass} pl-8`}
            />
          </div>
          <select
            value={planId}
            onChange={(e) => { setPlanId(e.target.value); setPage(1); }}
            className={`${fieldClass} w-auto min-w-[140px] max-w-[180px]`}
            aria-label="Filter by plan"
          >
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setPage(1); }}
            className={`${fieldClass} w-auto min-w-[138px]`}
            aria-label="Filter by month joined"
            title="Joined month"
          />
          <input
            type="date"
            value={day}
            onChange={(e) => { setDay(e.target.value); setPage(1); }}
            className={`${fieldClass} w-auto min-w-[138px]`}
            aria-label="Filter by day joined"
            title="Joined day"
          />
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X className="w-3 h-3" /> Reset
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
            {loading ? 'Loading…' : `${fmtNum(total)} subscriber${total !== 1 ? 's' : ''}`}
          </span>
        </div>

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
              <p className="text-sm">{hasFilters ? 'No subscribers match these filters.' : 'No monthly-plan subscribers yet.'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-semibold">User</th>
                  <th className="px-3 py-2 text-left font-semibold">Plan</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Joined</th>
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
                    <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(r.joined_at || r.created_at || r.start_date)}</td>
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
