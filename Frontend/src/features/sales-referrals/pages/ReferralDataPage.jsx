import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, CircleDashed, Download, IndianRupee, Receipt, RefreshCw, Table2, Users } from 'lucide-react';
import { KpiCard } from '../../users/userAnalytics/AnalyticsCharts';
import { REFERRAL_DATA_TEXT, REFERRAL_DATA_TOOLTIPS } from '../constants/referralData.text';
import { DEFAULT_REFERRAL_DATA_FILTERS, PLAN_STATUS_FILTER, REFERRAL_DATA_PAGE_SIZE } from '../types/referralData.types';
import {
  getReferralDataOwners, getReferralDataStatusCounts, getReferralDataSummary, getReferralPayments, getReferralUsers, getUserHistory, userHistoryCsv,
} from '../referralDataApi';
import { EMPTY_RANGE, errorText, fmtNum, pct, toast } from '../utils/salesReferrals.utils';
import { DATA_TAB, activeFilterChips, fmtInr, panelId, tabId } from '../utils/referralData.utils';
import { downloadBlob } from '../utils/csv';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { salesReferralsPath } from '../salesReferrals.routes';
import { Breadcrumb, Button, Callout, EmptyState, ErrorState, SkeletonBlock } from '../components/primitives';
import ReferralDataFilterBar from '../components/referral-data/ReferralDataFilterBar';
import Tabs from '../components/referral-data/Tabs';
import UsersTable from '../components/referral-data/UsersTable';
import PaymentsTable from '../components/referral-data/PaymentsTable';
import PaginationFooter from '../components/referral-data/PaginationFooter';
import ExportCsvDialog from '../dialogs/ExportCsvDialog';
import { createDebugLogger } from '../../../shared/utils/debugLogger';

const T = REFERRAL_DATA_TEXT;
const TIP = REFERRAL_DATA_TOOLTIPS;
const log = createDebugLogger('ReferralDataPage');
const MAX_USERS = 5000; // backend cap per request (`truncated: true` when hit)

// Filters kept in component state (the onboarding date range lives in the URL via useDateRangeFilter).
const LOCAL_DEFAULTS = Object.freeze({
  ownerId: undefined, code: undefined, ownerType: 'ALL', planStatus: PLAN_STATUS_FILTER.ALL, includeDirect: true, search: '', page: 1,
});

const Tip = ({ tip, children }) => <div title={tip}>{children}</div>;

const PageLoading = () => (
  <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading">
    <SkeletonBlock className="h-28" />
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
    </div>
    <SkeletonBlock className="h-80" />
  </div>
);

/** /dashboard/sales-referrals/data — read-only report over GET /api/admin/onboarded-users. */
const ReferralDataPage = () => {
  const dateRange = useDateRangeFilter();
  const { range, preset, setRange, applyPreset, search: rangeSearch } = dateRange;
  const [local, setLocal] = useState(LOCAL_DEFAULTS);
  const [searchInput, setSearchInput] = useState('');
  const [tab, setTab] = useState(DATA_TAB.USERS);

  const [owners, setOwners] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusCounts, setStatusCounts] = useState(null);
  const [users, setUsers] = useState(null);
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [expanded, setExpanded] = useState(() => new Set());
  const [histories, setHistories] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const scrollRef = useRef(null);
  const [detailWidth, setDetailWidth] = useState(0);

  // Width of the horizontally scrolling table container → expanded-row cards fit the visible area.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setDetailWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, tab, users]);

  // Debounced search → filters (and back to page 1).
  useEffect(() => {
    const id = setTimeout(() => setLocal((l) => (l.search === searchInput.trim() ? l : { ...l, search: searchInput.trim(), page: 1 })), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  /** @type {import('../types/referralData.types').ReferralDataFilters} */
  const filters = useMemo(() => ({ ...DEFAULT_REFERRAL_DATA_FILTERS, ...local, dateRange: range, pageSize: REFERRAL_DATA_PAGE_SIZE }), [local, range]);

  const update = useCallback((patch) => setLocal((l) => ({ ...l, ...patch, page: 1 })), []);
  const setPage = useCallback((page) => setLocal((l) => ({ ...l, page })), []);
  const changeTab = useCallback((next) => { setTab(next); setLocal((l) => (l.page === 1 ? l : { ...l, page: 1 })); }, []);

  useEffect(() => {
    getReferralDataOwners().then(setOwners).catch((err) => log.error('owners:error', err));
  }, []);

  const load = useCallback(async () => {
    setError(null); setRefreshing(true);
    try {
      const statusFiltered = filters.planStatus !== PLAN_STATUS_FILTER.ALL;
      const [s, counts, u, p] = await Promise.all([
        getReferralDataSummary(filters),
        statusFiltered ? getReferralDataStatusCounts(filters) : null,          // pills ignore the status filter
        getReferralUsers(filters),
        tab === DATA_TAB.PAYMENTS ? getReferralPayments(filters) : null,
      ]);
      setSummary(s);
      setStatusCounts(counts || { all: s.users, free: s.free, paid: s.paidNow, lapsed: s.lapsed });
      setUsers(u);
      if (p) setPayments(p);
      log.flow('loaded', { summary: { users: s.users, payments: s.payments, totalPaid: s.totalPaidInr, page: u.page, tab, truncated: u.truncated } });
    } catch (err) {
      log.error('load:error', err);
      setError(errorText(err));
    } finally { setLoading(false); setRefreshing(false); }
  }, [filters, tab]);

  useEffect(() => { load(); }, [load]);

  // ── Expand / subscription history (cached per user) ───────────────────────
  const loadHistory = useCallback(async (userId) => {
    setHistories((h) => ({ ...h, [userId]: { status: 'loading' } }));
    try {
      const data = await getUserHistory(userId);
      setHistories((h) => ({ ...h, [userId]: { status: 'ok', data } }));
      return data;
    } catch (err) {
      log.error('history:error', err);
      setHistories((h) => ({ ...h, [userId]: { status: 'error', error: errorText(err) } }));
      throw err;
    }
  }, []);

  const toggleRow = useCallback((userId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
    if (!histories[userId] || histories[userId].status === 'error') loadHistory(userId).catch(() => {});
  }, [histories, loadHistory]);

  const downloadHistory = useCallback(async (row) => {
    setDownloadingId(row.userId);
    try {
      const cached = histories[row.userId];
      const data = cached?.status === 'ok' ? cached.data : await loadHistory(row.userId);
      const res = userHistoryCsv(data);
      downloadBlob(res.blob, res.fileName);
      toast('success', T.export.downloaded(res.fileName));
    } catch (err) {
      log.error('history-export:error', err);
      toast('error', T.export.failed, errorText(err));
    } finally { setDownloadingId(null); }
  }, [histories, loadHistory]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const selectOwner = useCallback((ownerId) => {
    update({ ownerId, code: undefined });
    const name = owners.find((o) => o.id === ownerId)?.name;
    if (name) toast('info', T.filters.filteredBy(name));
  }, [owners, update]);

  const clearAll = useCallback(() => { setLocal(LOCAL_DEFAULTS); setSearchInput(''); setRange(EMPTY_RANGE); }, [setRange]);
  const removeChip = useCallback((key) => {
    if (key === 'dateRange') { setRange(EMPTY_RANGE); return; }
    if (key === 'search') { setSearchInput(''); update({ search: '' }); return; }
    if (key === 'ownerId') { update({ ownerId: undefined, code: undefined }); return; }
    update({ [key]: LOCAL_DEFAULTS[key] });
  }, [setRange, update]);

  const chips = useMemo(() => activeFilterChips(filters, owners), [filters, owners]);

  const tabs = [
    { id: DATA_TAB.USERS, label: T.tabs.users, icon: Users, count: summary?.users },
    { id: DATA_TAB.PAYMENTS, label: T.tabs.payments, icon: Receipt, count: summary?.payments },
  ];
  const paged = tab === DATA_TAB.USERS ? users : payments;
  const emptyUsers = users && users.totalItems === 0;

  return (
    <div className="p-3 sm:p-5 space-y-5 min-w-0 max-w-full">
      <Breadcrumb items={[{ label: T.breadcrumbRoot, to: salesReferralsPath.overview(rangeSearch) }, { label: T.title }]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Table2 className="w-7 h-7 text-blue-600" />{T.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{T.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={RefreshCw} onClick={load} disabled={refreshing} className={refreshing ? '[&>svg]:animate-spin' : ''}>{T.refresh}</Button>
          <Button variant="primary" icon={Download} onClick={() => setExportOpen(true)} disabled={loading || !summary}>{T.exportCsv}</Button>
        </div>
      </div>

      {error && !summary ? (
        <ErrorState title={T.error} message={error} onRetry={load} />
      ) : loading ? (
        <PageLoading />
      ) : (
        <>
          <ReferralDataFilterBar
            range={range}
            preset={preset}
            onPreset={(id) => { applyPreset(id); setPage(1); }}
            onRange={(r) => { setRange(r); setPage(1); }}
            owners={owners}
            filters={filters}
            statusCounts={statusCounts}
            searchInput={searchInput}
            onSearchInput={setSearchInput}
            chips={chips}
            onChange={update}
            onRemoveChip={removeChip}
            onClearAll={clearAll}
          />

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {summary?.truncated && <Callout tone="warning">{T.truncated(fmtNum(MAX_USERS))}</Callout>}

          {summary && (
            <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 ${refreshing ? 'opacity-70' : ''}`}>
              <Tip tip={TIP.users}><KpiCard icon={Users} tone="blue" label={T.cards.users} value={fmtNum(summary.users)} sub={T.cards.usersSub(fmtNum(summary.viaCode), fmtNum(summary.direct))} /></Tip>
              <Tip tip={TIP.paidNow}><KpiCard icon={BadgeCheck} tone="emerald" label={T.cards.paidNow} value={fmtNum(summary.paidNow)} sub={T.cards.paidNowSub(pct(summary.paidNow, summary.users))} /></Tip>
              <Tip tip={TIP.payments}><KpiCard icon={Receipt} tone="violet" label={T.cards.payments} value={fmtNum(summary.payments)} sub={T.cards.paymentsSub} /></Tip>
              <Tip tip={TIP.collected}><KpiCard icon={IndianRupee} tone="emerald" label={T.cards.collected} value={fmtInr(summary.totalPaidInr)} sub={T.cards.collectedSub(fmtInr(summary.subscriptionPaid), fmtInr(summary.topupPaid), fmtInr(summary.storagePaid))} /></Tip>
              <Tip tip={TIP.freeLapsed}><KpiCard icon={CircleDashed} tone="slate" label={T.cards.freeLapsed} value={`${fmtNum(summary.free)} · ${fmtNum(summary.lapsed)}`} sub={T.cards.freeLapsedSub} /></Tip>
            </div>
          )}

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <Tabs tabs={tabs} value={tab} onChange={changeTab} label={T.title} />
              <span className="text-xs text-slate-400">{tab === DATA_TAB.USERS ? T.tabs.hintUsers : T.tabs.hintPayments}</span>
            </div>

            <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} className={refreshing ? 'opacity-70' : ''}>
              {tab === DATA_TAB.USERS ? (
                emptyUsers ? (
                  <div className="p-4">
                    <EmptyState icon={Users} title={T.table.emptyTitle} body={T.table.emptyBody} action={<Button onClick={clearAll}>{T.filters.clearFilters}</Button>} />
                  </div>
                ) : (
                  <div className="overflow-x-auto" ref={scrollRef}>
                    <UsersTable
                      rows={users?.items || []}
                      expanded={expanded}
                      histories={histories}
                      onToggle={toggleRow}
                      onSelectOwner={selectOwner}
                      onRetryHistory={(id) => loadHistory(id).catch(() => {})}
                      onDownloadHistory={downloadHistory}
                      downloadingId={downloadingId}
                      detailWidth={detailWidth}
                    />
                  </div>
                )
              ) : payments ? (
                <div className="overflow-x-auto">
                  <PaymentsTable rows={payments.items} onSelectOwner={selectOwner} />
                </div>
              ) : (
                <div className="p-4 space-y-2 animate-pulse" aria-busy="true"><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /></div>
              )}
            </div>

            {paged && paged.totalItems > 0 && (
              <PaginationFooter data={paged} onPage={setPage} disabled={refreshing} eventsOnPage={tab === DATA_TAB.PAYMENTS ? paged.items.length : undefined} />
            )}
          </section>
        </>
      )}

      <ExportCsvDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={filters}
        filteredSummary={summary}
        activeFilterCount={chips.length}
      />
    </div>
  );
};

export default ReferralDataPage;
