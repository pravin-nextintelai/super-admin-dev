import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ChevronDown, ChevronUp, Plus, Search, Table2, Ticket, UserMinus, Users, X, BadgeCheck, Clock, CircleDashed, RefreshCw } from 'lucide-react';
import { KpiCard } from '../../../pages/dashboard/userAnalytics/AnalyticsCharts';
import { SALES_REFERRALS_TEXT, SALES_REFERRALS_TOOLTIPS } from '../constants/salesReferrals.text';
import { REFERRAL_DATA_TEXT } from '../constants/referralData.text';
import { OWNER_TYPE_FILTER } from '../types/salesReferrals.types';
import { getOwnersReport, getSummary } from '../services/salesReferrals.api';
import { errorText, fmtDate, fmtNum, pct } from '../utils/salesReferrals.utils';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { salesReferralsPath } from '../salesReferrals.routes';
import DateRangeFilter from '../components/DateRangeFilter';
import NewOwnerDialog from '../dialogs/NewOwnerDialog';
import { Avatar, Button, EmptyState, ErrorState, MixBar, PageSkeleton, PaidPctBar, SegmentedControl, TypeBadge } from '../components/primitives';
import { inputClass } from '../components/formClasses';
import { createDebugLogger } from '../../../utils/debugLogger';

const T = SALES_REFERRALS_TEXT.overview;
const TIP = SALES_REFERRALS_TOOLTIPS;
const log = createDebugLogger('SalesReferralsOverview');

const TYPE_OPTIONS = [
  { value: OWNER_TYPE_FILTER.ALL, label: T.typeAll },
  { value: OWNER_TYPE_FILTER.INTERNAL, label: T.typeInternal },
  { value: OWNER_TYPE_FILTER.OUTSOURCED, label: T.typeOutsourced },
];

// Sorting is server-side (A13 `sort` / `direction`); only its sort keys are sortable.
const COLUMNS = [
  { key: 'name', label: T.table.owner, sortable: true },
  { key: 'type', label: T.table.type, sortable: false },
  { key: 'codes', label: T.table.codes, sortable: false },
  { key: 'signups', label: T.table.signups, sortable: true },
  { key: 'free', label: T.table.free, sortable: true, numeric: true },
  { key: 'paid', label: T.table.paid, sortable: true, numeric: true },
  { key: 'lapsed', label: T.table.lapsed, sortable: true, numeric: true },
  { key: 'paidPercent', label: T.table.paidPct, sortable: true, tip: TIP.paidPct },
  { key: 'actions', label: '', sortable: false },
];

const TH = 'px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
const TD = 'px-3 py-3 align-middle';

const Tip = ({ tip, children }) => <div title={tip}>{children}</div>;

const SalesReferralsOverviewPage = () => {
  const navigate = useNavigate();
  const { range, preset, setRange, applyPreset, search: rangeSearch } = useDateRangeFilter();
  const [ownerType, setOwnerType] = useState(OWNER_TYPE_FILTER.ALL);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'signups', dir: 'desc' });
  const [summary, setSummary] = useState(null);   // A12
  const [report, setReport] = useState(null);     // A13 { ownerCountAll, owners, direct }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const [s, o] = await Promise.all([
        getSummary({ dateRange: range, type: ownerType }),
        getOwnersReport({ dateRange: range, type: ownerType, search, sort: sort.key, direction: sort.dir }),
      ]);
      setSummary(s); setReport(o);
      log.flow('loaded', { summary: { total: s.totalSignups, viaCode: s.viaCode, direct: s.direct, owners: o.owners?.length, ownerCountAll: o.ownerCountAll } });
    } catch (err) {
      log.error('load:error', err);
      setError(errorText(err));
    } finally { setLoading(false); setRefreshing(false); }
  }, [range, ownerType, search, sort]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => report?.owners || [], [report]);
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const clearFilters = () => { setOwnerType(OWNER_TYPE_FILTER.ALL); setSearchInput(''); setSearch(''); };
  const existingNames = useMemo(() => rows.map((r) => r.name), [rows]);
  const noOwnersAtAll = report ? report.ownerCountAll === 0 : false;

  return (
    <div className="p-3 sm:p-5 space-y-5 min-w-0 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Ticket className="w-7 h-7 text-blue-600" />{T.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {T.subtitle}{summary?.trackingSince && <span className="text-slate-400"> · {T.trackingSince(fmtDate(`${summary.trackingSince}T00:00:00+05:30`))}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={RefreshCw} onClick={load} disabled={refreshing} aria-label="Refresh" className={refreshing ? '[&>svg]:animate-spin' : ''}>Refresh</Button>
          <Button icon={Table2} onClick={() => navigate(salesReferralsPath.data(rangeSearch))} title={REFERRAL_DATA_TEXT.entryTitle}>{REFERRAL_DATA_TEXT.entryButton}</Button>
          <Button variant="primary" icon={Plus} onClick={() => setDialogOpen(true)}>{T.newOwner}</Button>
        </div>
      </div>

      {error && !loading ? (
        <ErrorState title={T.error.title} message={error} onRetry={load} />
      ) : loading ? (
        <PageSkeleton cards={6} />
      ) : noOwnersAtAll ? (
        <EmptyState icon={Users} title={T.empty.title} body={T.empty.body} action={<Button variant="primary" icon={Plus} onClick={() => setDialogOpen(true)}>{T.newOwner}</Button>} />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
            <DateRangeFilter range={range} preset={preset} onPreset={applyPreset} onRange={setRange} />
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <SegmentedControl options={TYPE_OPTIONS} value={ownerType} onChange={setOwnerType} label={T.table.type} />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={T.searchPlaceholder} aria-label={T.searchPlaceholder} className={`${inputClass(false)} pl-9 pr-8 w-56`} />
                {searchInput && (
                  <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
          </div>

          {summary && (
            <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 ${refreshing ? 'opacity-70' : ''}`}>
              <Tip tip={TIP.totalSignups}><KpiCard icon={Users} tone="blue" label={T.cards.total} value={fmtNum(summary.totalSignups)} sub={T.cards.totalSub} /></Tip>
              <Tip tip={TIP.viaCode}><KpiCard icon={Ticket} tone="violet" label={T.cards.viaCode} value={fmtNum(summary.viaCode)} sub={T.cards.viaCodeOfAll(pct(summary.viaCode, summary.totalSignups))} /></Tip>
              <Tip tip={TIP.direct}><KpiCard icon={UserMinus} tone="slate" label={T.cards.direct} value={fmtNum(summary.direct)} sub={T.cards.directSub} /></Tip>
              <Tip tip={TIP.free}><KpiCard icon={CircleDashed} tone="slate" label={T.cards.free} value={fmtNum(summary.free?.total)} sub={T.cards.viaCodeCount(summary.free?.viaCode ?? 0)} /></Tip>
              <Tip tip={TIP.paid}><KpiCard icon={BadgeCheck} tone="emerald" label={T.cards.paid} value={fmtNum(summary.paid?.total)} sub={T.cards.paidViaCode(summary.paid?.viaCode ?? 0, summary.paidPercent ?? 0)} /></Tip>
              <Tip tip={TIP.lapsed}><KpiCard icon={Clock} tone="amber" label={T.cards.lapsed} value={fmtNum(summary.lapsed?.total)} sub={T.cards.viaCodeCount(summary.lapsed?.viaCode ?? 0)} /></Tip>
            </div>
          )}

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-label={T.table.title}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">{T.table.title}</h2>
              <span className="text-xs text-slate-400">{fmtNum(rows.length)} {rows.length === 1 ? 'owner' : 'owners'}</span>
            </div>
            {rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                <p>{T.table.noMatch}</p>
                <Button variant="link" onClick={clearFilters} className="mt-2 text-sm">{T.table.clearFilters}</Button>
              </div>
            ) : (
              <div className={`overflow-x-auto ${refreshing ? 'opacity-70' : ''}`}>
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {COLUMNS.map((c) => {
                        const active = sort.key === c.key;
                        const SortIcon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ArrowUpDown;
                        return (
                          <th key={c.key} scope="col" className={`${TH} ${c.numeric ? 'text-right' : ''}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} title={c.tip}>
                            {c.sortable ? (
                              <button type="button" onClick={() => toggleSort(c.key)} className={`inline-flex items-center gap-1 hover:text-slate-800 ${active ? 'text-slate-800' : ''}`}>
                                {c.label}<SortIcon className={`w-3 h-3 ${active ? '' : 'opacity-40'}`} />
                              </button>
                            ) : c.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => navigate(salesReferralsPath.owner(r.id, rangeSearch))}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className={TD}>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={r.name} />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{r.name}</p>
                              <p className="text-[11px] text-slate-400">{T.table.since(fmtDate(r.createdAt))}</p>
                            </div>
                          </div>
                        </td>
                        <td className={TD}><TypeBadge internal={r.internal} /></td>
                        <td className={`${TD} text-slate-700 whitespace-nowrap`}>{T.table.codesCount(r.codes?.active ?? 0, r.codes?.total ?? 0)}</td>
                        <td className={TD}>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-800 tabular-nums w-8 text-right">{fmtNum(r.signups)}</span>
                            <MixBar free={r.free} paid={r.paid} lapsed={r.lapsed} />
                          </div>
                        </td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{fmtNum(r.free)}</td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{fmtNum(r.paid)}</td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{fmtNum(r.lapsed)}</td>
                        <td className={TD}><PaidPctBar value={r.paidPercent} /></td>
                        <td className={`${TD} text-right`}>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(salesReferralsPath.owner(r.id, rangeSearch)); }}>{T.table.open}</Button>
                        </td>
                      </tr>
                    ))}
                    {report?.direct && (
                      <tr className="bg-slate-50/60">
                        <td className={TD}>
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center"><UserMinus className="w-4 h-4" /></span>
                            <div>
                              <p className="font-semibold text-slate-700">{T.table.direct}</p>
                              <p className="text-[11px] text-slate-400">{T.table.directSub}</p>
                            </div>
                          </div>
                        </td>
                        <td className={TD}><span className="text-slate-300">—</span></td>
                        <td className={TD}><span className="text-slate-300">—</span></td>
                        <td className={TD}>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-800 tabular-nums w-8 text-right">{fmtNum(report.direct.signups)}</span>
                            <MixBar free={report.direct.free} paid={report.direct.paid} lapsed={report.direct.lapsed} />
                          </div>
                        </td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{fmtNum(report.direct.free)}</td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{fmtNum(report.direct.paid)}</td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{fmtNum(report.direct.lapsed)}</td>
                        <td className={TD}><PaidPctBar value={report.direct.paidPercent} /></td>
                        <td className={TD} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <NewOwnerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} existingNames={existingNames} onCreated={load} />
    </div>
  );
};

export default SalesReferralsOverviewPage;
