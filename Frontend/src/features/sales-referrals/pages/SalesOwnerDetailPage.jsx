import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, CircleDashed, Clock, Copy, Eye, Link2, LinkIcon, Mail, Pencil, Plus, Power, RefreshCw, Users, Tag } from 'lucide-react';
import { KpiCard } from '../../../pages/dashboard/userAnalytics/AnalyticsCharts';
import { SALES_REFERRALS_TEXT, SALES_REFERRALS_TOOLTIPS } from '../constants/salesReferrals.text';
import { getOwner, getOwnerCodesReport, getOwnersReport } from '../services/salesReferrals.api';
import { copyText, errorText, fmtDate, fmtNum, referralLink, referralLinks } from '../utils/salesReferrals.utils';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { salesReferralsPath } from '../salesReferrals.routes';
import DateRangeFilter from '../components/DateRangeFilter';
import RowMenu from '../components/RowMenu';
import AddCodeDialog from '../dialogs/AddCodeDialog';
import EditOwnerDialog from '../dialogs/EditOwnerDialog';
import EditLabelDialog from '../dialogs/EditLabelDialog';
import RefreshCodeDialog from '../dialogs/RefreshCodeDialog';
import CodeStatusDialog from '../dialogs/CodeStatusDialog';
import SendCodeEmailDialog from '../dialogs/SendCodeEmailDialog';
import { Avatar, Breadcrumb, Button, CodeStatusBadge, CodeText, ErrorState, MixBar, NewBadge, PageSkeleton, PaidPctBar, TypeBadge } from '../components/primitives';
import { createDebugLogger } from '../../../utils/debugLogger';

const T = SALES_REFERRALS_TEXT.owner;
const C = SALES_REFERRALS_TEXT.common;
const S = SALES_REFERRALS_TEXT.share;
const TIP = SALES_REFERRALS_TOOLTIPS;
const log = createDebugLogger('SalesOwnerDetail');

const TH = 'px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
const TD = 'px-3 py-3 align-middle';

const SalesOwnerDetailPage = () => {
  const { ownerId } = useParams();
  const navigate = useNavigate();
  const { range, preset, setRange, applyPreset, search: rangeSearch } = useDateRangeFilter();
  const [owner, setOwner] = useState(null);     // A3
  const [report, setReport] = useState(null);   // A14 { owner, totals, codes }
  const [existingNames, setExistingNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // { type: 'add'|'edit'|'label'|'refresh'|'deactivate'|'activate', code? }
  const [emailDialog, setEmailDialog] = useState(null); // { code, offer } — kept separate so a closing action dialog can hand over to it

  const load = useCallback(async () => {
    setError(null); setRefreshing(true);
    try {
      const [o, r, all] = await Promise.all([getOwner(ownerId), getOwnerCodesReport(ownerId, { dateRange: range }), getOwnersReport({})]);
      setOwner(o); setReport(r);
      setExistingNames((all.owners || []).map((x) => x.name));
      log.flow('loaded', { summary: { owner: o.name, codes: r.codes?.length, signups: r.totals?.signups } });
    } catch (err) {
      log.error('load:error', err);
      setError(errorText(err));
    } finally { setLoading(false); setRefreshing(false); }
  }, [ownerId, range]);

  useEffect(() => { load(); }, [load]);

  const close = () => setDialog(null);
  const afterChange = () => load();
  /** After a code is created, refreshed or disabled, offer to email the result to the sales owner right away. */
  const afterCodeChange = (result) => {
    load();
    const code = result?.newCode || result; // refresh returns { oldCode, newCode }
    if (code?.id && code?.code) setEmailDialog({ code, offer: true });
  };

  const menuFor = (c) => {
    const links = referralLinks(c.code);
    const items = [];
    if (c.active) {
      items.push({ id: 'copy-code', label: T.menu.copyCode, icon: Copy, onSelect: () => copyText(c.code, S.copiedCode) });
      items.push({ id: 'copy-link', label: links.local ? T.menu.copyLink : T.menu.copyLinkOnly, icon: Link2, onSelect: () => copyText(links.live, S.copiedLink) });
      if (links.local) items.push({ id: 'copy-local-link', label: T.menu.copyLocalLink, icon: Link2, onSelect: () => copyText(links.local, S.copiedLink) });
    }
    items.push({ id: 'signups', label: T.menu.viewSignups, icon: Eye, onSelect: () => navigate(salesReferralsPath.codeSignups(ownerId, c.id, rangeSearch)) });
    items.push({ id: 'email', label: T.menu.sendEmail, icon: Mail, onSelect: () => setEmailDialog({ code: c, offer: false }) });
    items.push({ id: 'label', label: T.menu.editLabel, icon: Tag, onSelect: () => setDialog({ type: 'label', code: c }) });
    if (c.active) {
      items.push({ id: 'refresh', label: T.menu.refresh, icon: RefreshCw, onSelect: () => setDialog({ type: 'refresh', code: c }) });
      items.push({ id: 'deactivate', label: T.menu.deactivate, icon: Power, danger: true, onSelect: () => setDialog({ type: 'deactivate', code: c }) });
    } else if (!c.replacedByCode) {
      items.push({ id: 'activate', label: T.menu.activate, icon: Power, onSelect: () => setDialog({ type: 'activate', code: c }) });
    }
    return items;
  };

  const stats = report?.totals;
  // A14 rows carry the numbers; A3 rows carry createdAt. A code is "new" when another code was refreshed into it.
  const replacedCodes = new Set((owner?.codes || []).map((c) => c.replacedByCode).filter(Boolean));
  const codes = (report?.codes || []).map((c) => {
    const base = (owner?.codes || []).find((x) => x.id === c.id);
    return { ...c, createdAt: base?.createdAt, isReplacement: replacedCodes.has(c.code) };
  });
  const codeCounts = owner?.codeCounts || { active: codes.filter((c) => c.active).length, total: codes.length };

  return (
    <div className="p-3 sm:p-5 space-y-5 min-w-0 max-w-full">
      <Breadcrumb items={[{ label: T.breadcrumbRoot, to: salesReferralsPath.overview(rangeSearch) }, { label: owner?.name || '…' }]} />

      {error && !loading ? (
        <ErrorState title={T.error} message={error} onRetry={load} />
      ) : loading || !owner || !report ? (
        <PageSkeleton cards={4} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <Avatar name={owner.name} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900">{owner.name}</h1>
                  <TypeBadge internal={owner.internal} />
                </div>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{owner.notes || <span className="text-slate-400">{T.noNotes}</span>}</p>
                <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />{T.emailLine(owner.email)}</p>
                <p className="text-xs text-slate-400 mt-1">{T.created(fmtDate(owner.createdAt))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button icon={Mail} title={T.sendAllTitle} onClick={() => setEmailDialog({ codes: codes.filter((c) => c.active), offer: false })}>{T.sendAll}</Button>
              <Button icon={Pencil} onClick={() => setDialog({ type: 'edit' })}>{T.edit}</Button>
              <Button variant="primary" icon={Plus} onClick={() => setDialog({ type: 'add' })}>{T.addCode}</Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <DateRangeFilter range={range} preset={preset} onPreset={applyPreset} onRange={setRange} />
          </div>

          <div className={`grid grid-cols-2 xl:grid-cols-4 gap-3 ${refreshing ? 'opacity-70' : ''}`}>
            <div title={TIP.viaCode}><KpiCard icon={Users} tone="blue" label={T.cards.signups} value={fmtNum(stats.signups)} sub={T.cards.acrossCodes(codeCounts.total)} /></div>
            <div title={TIP.free}><KpiCard icon={CircleDashed} tone="slate" label={T.cards.free} value={fmtNum(stats.free)} sub={T.cards.ofSignups(stats.signups ? Math.round((stats.free / stats.signups) * 100) : 0)} /></div>
            <div title={TIP.paid}><KpiCard icon={BadgeCheck} tone="emerald" label={T.cards.paid} value={fmtNum(stats.paid)} sub={T.cards.paidPct(stats.paidPercent)} /></div>
            <div title={TIP.lapsed}><KpiCard icon={Clock} tone="amber" label={T.cards.lapsed} value={fmtNum(stats.lapsed)} sub={T.cards.ofSignups(stats.signups ? Math.round((stats.lapsed / stats.signups) * 100) : 0)} /></div>
          </div>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-label={T.table.title}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">{T.table.title}</h2>
              <Link to={salesReferralsPath.ownerSignups(ownerId, rangeSearch)} className="text-xs font-medium text-blue-700 hover:underline">{SALES_REFERRALS_TEXT.signups.titleOwner} →</Link>
            </div>
            {codes.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">{T.table.empty}</p>
            ) : (
              <div className={`overflow-x-auto ${refreshing ? 'opacity-70' : ''}`}>
                <table className="w-full text-sm min-w-[960px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className={TH}>{T.table.code}</th>
                      <th scope="col" className={TH}>{T.table.label}</th>
                      <th scope="col" className={TH}>{T.table.status}</th>
                      <th scope="col" className={TH}>{T.table.signups}</th>
                      <th scope="col" className={`${TH} text-right`}>{T.table.free}</th>
                      <th scope="col" className={`${TH} text-right`}>{T.table.paid}</th>
                      <th scope="col" className={`${TH} text-right`}>{T.table.lapsed}</th>
                      <th scope="col" className={TH} title={TIP.paidPct}>{T.table.paidPct}</th>
                      <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {codes.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => navigate(salesReferralsPath.codeSignups(ownerId, c.id, rangeSearch))}
                        className={`cursor-pointer ${c.active ? 'hover:bg-slate-50' : 'bg-slate-50/70 text-slate-400 hover:bg-slate-100/70'}`}
                      >
                        <td className={TD}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={salesReferralsPath.codeSignups(ownerId, c.id, rangeSearch)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded hover:underline"
                              title={`${T.menu.viewSignups}: ${c.code}`}
                            >
                              <CodeText code={c.code} struck={!c.active} />
                            </Link>
                            {c.isReplacement && <NewBadge>{T.table.newBadge(fmtDate(c.createdAt))}</NewBadge>}
                          </div>
                          {c.replacedByCode && (
                            <p className="text-[11px] text-slate-400 mt-0.5">· {T.table.replacedBy(c.replacedByCode)}</p>
                          )}
                        </td>
                        <td className={`${TD} ${c.active ? 'text-slate-700' : ''}`}>{c.label || <span className="text-slate-300">{T.table.noLabel}</span>}</td>
                        <td className={TD}><CodeStatusBadge active={c.active} /></td>
                        <td className={TD}>
                          <div className="flex items-center gap-3">
                            <Link
                              to={salesReferralsPath.codeSignups(ownerId, c.id, rangeSearch)}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-blue-700 hover:underline tabular-nums w-8 text-right"
                              aria-label={`${T.menu.viewSignups}: ${c.code}`}
                            >
                              {fmtNum(c.signups)}
                            </Link>
                            <MixBar free={c.free} paid={c.paid} lapsed={c.lapsed} className={c.active ? '' : 'opacity-60'} />
                          </div>
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtNum(c.free)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtNum(c.paid)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtNum(c.lapsed)}</td>
                        <td className={TD}><PaidPctBar value={c.paidPercent} /></td>
                        <td className={`${TD} text-right whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            {c.active ? (
                              <Button size="sm" icon={Link2} onClick={(e) => { e.stopPropagation(); copyText(referralLink(c.code), S.copiedLink); }} aria-label={`${T.table.copyLink} ${c.code}`}>{T.table.copyLink}</Button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400"><LinkIcon className="w-3.5 h-3.5" />{T.table.linkOff}</span>
                            )}
                            <RowMenu label={`${T.menu.open}: ${c.code}`} items={menuFor(c)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <AddCodeDialog open={dialog?.type === 'add'} onClose={close} owner={owner} existingCodes={codes.map((c) => c.code)} onAdded={afterCodeChange} />
          <EditOwnerDialog open={dialog?.type === 'edit'} onClose={close} owner={owner} existingNames={existingNames} onSaved={afterChange} />
          <EditLabelDialog open={dialog?.type === 'label'} onClose={close} code={dialog?.code} onSaved={afterChange} />
          <RefreshCodeDialog open={dialog?.type === 'refresh'} onClose={close} code={dialog?.code} onRefreshed={afterCodeChange} />
          <CodeStatusDialog open={dialog?.type === 'deactivate' || dialog?.type === 'activate'} mode={dialog?.type} onClose={close} code={dialog?.code} onChanged={afterCodeChange} />
          <SendCodeEmailDialog open={Boolean(emailDialog)} onClose={() => setEmailDialog(null)} owner={owner} code={emailDialog?.code} codes={emailDialog?.codes} offer={emailDialog?.offer} onSent={load} />
        </>
      )}
      {!loading && (!owner || !report) && !error && <p className="text-sm text-slate-500">{C.somethingWrong}</p>}
    </div>
  );
};

export default SalesOwnerDetailPage;
