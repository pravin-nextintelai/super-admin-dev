import React from 'react';
import { Ban, Check, Database, Download, HardDrive, Play, Receipt, Ticket, Zap } from 'lucide-react';
import { REFERRAL_DATA_TEXT } from '../../constants/referralData.text';
import { EVENT_TYPE } from '../../types/referralData.types';
import { fmtDate, fmtNum } from '../../utils/salesReferrals.utils';
import { accountTypeLabel, fmtDateTime12, fmtInr, statusTone } from '../../utils/referralData.utils';
import { Button, CodeText, ErrorState, SkeletonBlock, TypeBadge } from '../primitives';
import { AttributionBadge, EventBadge, StatusBadge } from './cells';

const T = REFERRAL_DATA_TEXT;
const D = T.detail;

const EVENT_ICON = {
  [EVENT_TYPE.SIGNUP]: Play,
  [EVENT_TYPE.SUBSCRIPTION]: Receipt,
  [EVENT_TYPE.SUBSCRIPTION_CANCELLED]: Ban,
  [EVENT_TYPE.PAYMENT]: Check,
  [EVENT_TYPE.TOKEN_TOPUP]: Zap,
  [EVENT_TYPE.STORAGE_ADDON]: HardDrive,
};
const NODE_TONE = {
  ok: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  bad: 'bg-red-50 text-red-600 border-red-200',
  warn: 'bg-amber-50 text-amber-600 border-amber-200',
  muted: 'bg-slate-50 text-slate-500 border-slate-200',
};

/** Vertical timeline of subscription events (GET /:userId `timeline[]`), oldest first. */
export const HistoryTimeline = ({ events }) => {
  if (!events.length) return <p className="text-sm text-slate-500">{D.noEvents}</p>;
  return (
    <ol className="relative ml-3 border-l border-slate-200 space-y-4">
      {events.map((e) => {
        const Icon = EVENT_ICON[e.type] || Check;
        const tone = e.type === EVENT_TYPE.SIGNUP ? 'muted' : statusTone(e.status);
        return (
          <li key={e.id} className="relative pl-7">
            <span className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full border flex items-center justify-center ${NODE_TONE[tone]}`} aria-hidden="true">
              <Icon className="w-3 h-3" />
            </span>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                  {e.title}
                  <EventBadge type={e.type} />
                </p>
                {e.detail && <p className="text-xs text-slate-500 mt-0.5 break-words">{e.detail}</p>}
                <p className="text-[11px] text-slate-400 mt-0.5">{fmtDateTime12(e.occurredAt)}</p>
              </div>
              {e.amountInr !== null && e.amountInr > 0 && (
                <span className="text-sm font-bold text-slate-800 tabular-nums whitespace-nowrap">{fmtInr(e.amountInr)}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

const Card = ({ icon, title, action, children, footer }) => {
  const Icon = icon; // (eslint's no-unused-vars misses JSX-only use of destructured params)
  return (
    <section className="bg-white rounded-xl border border-slate-200 flex flex-col min-w-0">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <Icon className="w-4 h-4 text-slate-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="px-4 py-4 flex-1">{children}</div>
      {footer}
    </section>
  );
};

const Kv = ({ label, children }) => (
  <>
    <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-0.5">{label}</dt>
    <dd className="text-sm text-slate-800 min-w-0 break-words">{children}</dd>
  </>
);

/**
 * Expanded row content: Subscription history (left) + Referral & account (right); stacked on narrow screens.
 * `history`: { status: 'loading' | 'ok' | 'error', data?: UserHistory, error? } from the page's per-user cache.
 */
const UserDetail = ({ row, history, onRetryHistory, onDownloadHistory, downloading }) => {
  const data = history?.status === 'ok' ? history.data : null;
  const events = data?.events || [];
  const footer = data && (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-xl text-xs">
      <div><dt className="text-slate-500">{D.payments}</dt><dd className="font-semibold text-slate-800 tabular-nums">{fmtNum(row.purchaseCount)}</dd></div>
      <div><dt className="text-slate-500">{D.totalPaid}</dt><dd className="font-semibold text-slate-800 tabular-nums">{fmtInr(row.totalPaidInr)}</dd></div>
      <div><dt className="text-slate-500">{D.firstPayment}</dt><dd className="font-semibold text-slate-800">{row.firstPurchaseAt ? fmtDate(row.firstPurchaseAt) : D.none}</dd></div>
      <div><dt className="text-slate-500">{D.current}</dt><dd className="font-semibold text-slate-800">{row.currentPlanName || T.table.noPlan}</dd></div>
    </dl>
  );
  const ws = row.workspace;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card
        icon={Receipt}
        title={D.history}
        action={<Button size="sm" icon={Download} loading={downloading} disabled={!data} onClick={(e) => { e.stopPropagation(); onDownloadHistory(row); }}>{D.downloadHistory}</Button>}
        footer={footer}
      >
        {!history || history.status === 'loading' ? (
          <div className="space-y-3" aria-busy="true" aria-label={D.historyLoading}>
            <SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10 w-2/3" />
          </div>
        ) : history.status === 'error' ? (
          <ErrorState title={D.historyError} message={history.error} onRetry={() => onRetryHistory(row.userId)} />
        ) : (
          <HistoryTimeline events={events} />
        )}
      </Card>

      <Card icon={Ticket} title={D.referralDetails}>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3">
          <Kv label={D.channel}>{T.channels[row.channel] || row.channelLabel}</Kv>
          <Kv label={D.owner}>
            {row.ownerId ? <span className="inline-flex items-center gap-2 flex-wrap">{row.ownerName}<TypeBadge internal={row.ownerType === 'INTERNAL'} /></span> : T.table.direct}
          </Kv>
          <Kv label={D.code}>
            {row.code ? (
              <span className="inline-flex items-center gap-2 flex-wrap">
                <CodeText code={row.code} struck={row.codeActive === false} className="text-xs" />
                {row.codeLabel && <span className="text-slate-500">· {row.codeLabel}</span>}
                {row.codeActive === false && <span className="text-xs text-slate-400">({D.codeInactive})</span>}
              </span>
            ) : D.none}
          </Kv>
          {row.attribution && (
            <Kv label={D.attribution}>
              <span className="inline-flex items-center gap-2 flex-wrap">
                <AttributionBadge attribution={row.attribution} />
                {row.referralLevel && <span className="text-xs text-slate-500">{T.referralLevel[row.referralLevel] || row.referralLevel}</span>}
              </span>
            </Kv>
          )}
          {row.attribution === 'ADMIN' && (
            <>
              <Kv label={D.setAt}>{row.attributionSetAt ? fmtDateTime12(row.attributionSetAt) : D.none}</Kv>
              <Kv label={D.reason}>{row.attributionReason || D.none}</Kv>
            </>
          )}
          <Kv label={D.onboarded}>{fmtDateTime12(row.signedUpAt)}</Kv>
          <Kv label={D.user}>
            {row.userName}
            <p className="text-xs text-slate-500">{row.userEmail}{row.phone && ` · ${row.phone}`}</p>
          </Kv>
          <Kv label={D.account}>
            <span className="inline-flex items-center gap-2 flex-wrap">
              {[accountTypeLabel(row.accountType), row.domainRole, row.approvalStatus].filter(Boolean).join(' · ') || D.none}
              {row.isBlocked ? <StatusBadge status="blocked" /> : row.isActive ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}
            </span>
          </Kv>
          <Kv label={D.workspace}>
            {ws ? <>{ws.name}<p className="text-xs text-slate-500">{[ws.type, ws.role, ws.city].filter(Boolean).join(' · ')}</p></> : <span className="text-slate-400">{T.table.noWorkspace}</span>}
          </Kv>
          <Kv label={D.lastLogin}>{row.lastLoginAt ? fmtDateTime12(row.lastLoginAt) : D.none}</Kv>
          {data?.storage && <Kv label={D.storage}><span className="inline-flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />{D.storageValue(data.storage.totalGb, fmtNum(data.storage.fileCount))}</span></Kv>}
        </dl>

        {data?.referralHistory?.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{D.referralHistory}</p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {data.referralHistory.map((h, i) => (
                <li key={`${h.changedAt}-${i}`}>
                  <span className="font-mono font-semibold text-slate-800">{D.referralChange(h.previousCode, h.newCode)}</span>
                  <span className="text-slate-400"> · {fmtDateTime12(h.changedAt)}{h.changedBy && ` · ${h.changedBy}`}</span>
                  {h.reason && <p className="text-slate-500">{h.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserDetail;
