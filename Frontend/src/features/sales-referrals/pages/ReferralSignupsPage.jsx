import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Link2, Search, X } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { getSignups } from '../services/salesReferrals.api';
import { copyText, errorText, fmtDate, fmtNum, pct, referralLink } from '../utils/salesReferrals.utils';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { salesReferralsPath } from '../salesReferrals.routes';
import DateRangeFilter from '../components/DateRangeFilter';
import { Avatar, Breadcrumb, Button, CodeStatusBadge, CodeText, ErrorState, IconButton, LabelBadge, PageSkeleton, PlanStatusBadge, TypeBadge } from '../components/primitives';
import { inputClass } from '../components/formClasses';
import { createDebugLogger } from '../../../utils/debugLogger';

const T = SALES_REFERRALS_TEXT.signups;
const S = SALES_REFERRALS_TEXT.share;
const log = createDebugLogger('ReferralSignups');
const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: 'ALL', label: T.filterAll, countKey: 'all' },
  { value: 'FREE', label: T.filterFree, countKey: 'free' },
  { value: 'PAID', label: T.filterPaid, countKey: 'paid' },
  { value: 'LAPSED', label: T.filterLapsed, countKey: 'lapsed' },
];

const TH = 'px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
const TD = 'px-3 py-3 align-middle';

/** A6 — signups for one code (`/:ownerId/codes/:codeId`) or for a whole owner (`/:ownerId/signups`). */
const ReferralSignupsPage = () => {
  const { ownerId, codeId } = useParams();
  const codeView = Boolean(codeId);
  const { range, preset, setRange, applyPreset, search: rangeSearch } = useDateRangeFilter();
  const [data, setData] = useState(null); // A15 { scope, statusCounts, items, page (1-based), totalItems, totalPages }
  const [status, setStatus] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useMemo(() => ({
    ...(codeView ? { codeId } : { ownerId }), status, search, dateRange: range, page, pageSize: PAGE_SIZE,
  }), [codeView, codeId, ownerId, status, search, range, page]);

  const loadList = useCallback(async () => {
    setListLoading(true); setError(null);
    try {
      const res = await getSignups(query);
      setData(res);
      log.flow('list:loaded', { summary: { total: res.totalItems, page: res.page, counts: res.statusCounts, scope: res.scope?.type } });
    } catch (err) {
      log.error('list:error', err);
      setError(errorText(err));
    } finally { setListLoading(false); setLoading(false); }
  }, [query]);

  useEffect(() => { loadList(); }, [loadList]);

  const code = data?.scope?.code || null;
  const owner = data?.scope?.owner || null;
  const counts = data?.statusCounts;
  const first = data && data.totalItems ? (data.page - 1) * data.size + 1 : 0;
  const last = data ? Math.min(data.page * data.size, data.totalItems) : 0;

  const crumbs = [
    { label: SALES_REFERRALS_TEXT.owner.breadcrumbRoot, to: salesReferralsPath.overview(rangeSearch) },
    { label: owner?.name || '…', to: salesReferralsPath.owner(ownerId, rangeSearch) },
    { label: codeView ? (code?.code || '…') : T.titleOwner },
  ];

  return (
    <div className="p-3 sm:p-5 space-y-5 min-w-0 max-w-full">
      <Breadcrumb items={crumbs} />

      {error && !data ? (
        <ErrorState title={T.error} message={error} onRetry={loadList} />
      ) : loading ? (
        <PageSkeleton cards={4} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {codeView ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CodeText code={code?.code || ''} struck={code && !code.active} className="text-xl" />
                    {code && <CodeStatusBadge active={code.active} />}
                    {code?.label && <LabelBadge>{code.label}</LabelBadge>}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{owner?.name}{counts && ` · ${T.summary(counts.all, counts.paid, pct(counts.paid, counts.all))}`}</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Avatar name={owner?.name} />
                    <h1 className="text-xl font-bold text-slate-900">{owner?.name}</h1>
                    {owner && <TypeBadge internal={owner.internal} />}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{T.titleOwner}{counts && ` · ${T.summary(counts.all, counts.paid, pct(counts.paid, counts.all))}`}</p>
                </>
              )}
            </div>
            {codeView && code?.active && (
              <Button icon={Link2} onClick={() => copyText(referralLink(code.code), S.copiedLink)}>{T.copyLink}</Button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 space-y-3">
            <DateRangeFilter range={range} preset={preset} onPreset={applyPreset} onRange={setRange} />
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label={T.columns.planStatus} className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((f) => {
                  const active = status === f.value;
                  const n = counts ? counts[f.countKey] : undefined;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setStatus(f.value); setPage(1); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {f.label}{n !== undefined && <span className={`ml-1.5 ${active ? 'text-slate-300' : 'text-slate-400'}`}>{fmtNum(n)}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="relative ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={T.searchPlaceholder} aria-label={T.searchPlaceholder} className={`${inputClass(false)} pl-9 pr-8 w-64`} />
                {searchInput && <IconButton size="sm" label="Clear search" icon={X} onClick={() => setSearchInput('')} className="absolute right-1.5 top-1/2 -translate-y-1/2" />}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {data.items.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">{T.empty}</p>
            ) : (
              <div className={`overflow-x-auto ${listLoading ? 'opacity-70' : ''}`}>
                <table className="w-full text-sm min-w-[820px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className={TH}>{T.columns.firm}</th>
                      <th scope="col" className={TH}>{T.columns.ownerEmail}</th>
                      <th scope="col" className={TH}>{T.columns.signupDate}</th>
                      {!codeView && <th scope="col" className={TH}>{T.columns.code}</th>}
                      <th scope="col" className={TH}>{T.columns.planStatus}</th>
                      <th scope="col" className={`${TH} text-right`}>{T.columns.seats}</th>
                      <th scope="col" className={TH}>{T.columns.emailVerified}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((r) => (
                      <tr key={r.tenantId} className="hover:bg-slate-50">
                        <td className={TD}>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={r.firmName} size="sm" />
                            <div className="min-w-0">
                              <span className="font-medium text-slate-800 truncate block">{r.firmName}</span>
                              <span className="text-[10px] text-slate-400">
                                {T.tenantType[r.tenantType] || r.tenantType}{r.source === 'ADMIN' && ` · ${T.adminSet}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className={`${TD} text-slate-700`}>
                          {r.ownerAccountDeleted || !r.ownerEmail ? <span className="text-slate-400 italic">{T.accountDeleted}</span> : r.ownerEmail}
                        </td>
                        <td className={`${TD} text-slate-700 whitespace-nowrap`}>{fmtDate(r.signedUpAt)}</td>
                        {!codeView && (
                          <td className={TD}>
                            {r.code ? <CodeText code={r.code} className="text-xs" /> : <span className="text-slate-300">—</span>}
                          </td>
                        )}
                        <td className={TD}><PlanStatusBadge status={r.planStatus} /></td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{r.seats}</td>
                        <td className={`${TD} ${r.emailVerified ? 'text-slate-700' : 'text-amber-600'}`}>{r.emailVerified ? T.verifiedYes : T.verifiedNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.totalItems > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                <p className="text-xs text-slate-500">{T.showing(fmtNum(first), fmtNum(last), fmtNum(data.totalItems))}</p>
                <div className="flex items-center gap-2">
                  <IconButton label={T.prev} icon={ChevronLeft} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1 || listLoading} className="border border-slate-200 bg-white" />
                  <span className="text-xs font-medium text-slate-600">{T.page(fmtNum(data.page), fmtNum(data.totalPages))}</span>
                  <IconButton label={T.next} icon={ChevronRight} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={data.page >= data.totalPages || listLoading} className="border border-slate-200 bg-white" />
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ReferralSignupsPage;
