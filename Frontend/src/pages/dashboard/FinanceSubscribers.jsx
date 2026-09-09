import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Eye, Lock, RefreshCw, Search, Users, X,
} from 'lucide-react';
import { fmtDate, fmtNum } from './userAnalytics/analyticsFormat';
import { ChartCard, EmptyState, StatusPill } from './userAnalytics/AnalyticsCharts';
import { fetchPlanSubscribers } from './userAnalytics/analyticsApi';
import { createDebugLogger } from '../../utils/debugLogger';

const financeSubscribersLogger = createDebugLogger('FinanceSubscribers');
const PAGE_SIZE = 25;

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
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [search, planId, month, day]);

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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Users & Plans</h1>
            <p className="text-sm text-slate-500">All monthly-plan subscribers — search by name or email, then filter by plan or join date.</p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ChartCard
        title="Subscribers"
        subtitle={loading ? 'Loading…' : `${fmtNum(total)} subscriber${total !== 1 ? 's' : ''}`}
        right={hasFilters ? (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="w-3 h-3" /> Reset
          </button>
        ) : null}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Search</span>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name or email"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plan</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            >
              <option value="">All plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Day</span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </label>
        </div>

        {err ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <p className="text-sm">{err}</p>
            <button onClick={load} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Retry</button>
          </div>
        ) : loading ? (
          <EmptyState icon={Users} text="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} text={hasFilters ? 'No subscribers match these filters.' : 'No monthly-plan subscribers yet.'} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Plan</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Joined</th>
                    <th className="px-3 py-2 text-right">Plan balance</th>
                    <th className="px-3 py-2 text-right">Top-up</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.user_id}-${r.plan_id}-${i}`} className="border-b border-slate-100 hover:bg-blue-50/40">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700 flex items-center gap-1.5">
                            {r.username || `User #${r.user_id}`}
                            {r.is_blocked && <Lock className="w-3 h-3 text-red-500" />}
                          </span>
                          {r.email && <span className="text-xs text-slate-400">{r.email}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">{r.plan_name || '—'}</td>
                      <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                      <td className="px-3 py-2 text-slate-600">{fmtDate(r.joined_at || r.created_at || r.start_date)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtNum(r.current_token_balance)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtNum(r.topup_token_balance)}</td>
                      <td className="px-3 py-2 text-right">
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
            </div>
            <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
              <p className="text-xs text-slate-500">Showing {fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)}</p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">Page {page} of {pageCount}</span>
                <button
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
};

export default FinanceSubscribers;
