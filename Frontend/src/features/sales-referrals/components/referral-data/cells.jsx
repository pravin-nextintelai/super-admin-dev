import React from 'react';
import { REFERRAL_DATA_TEXT } from '../../constants/referralData.text';
import { Avatar, CodeText, TypeBadge } from '../primitives';
import { fmtDate } from '../../utils/salesReferrals.utils';
import { fmtTime12, statusTone } from '../../utils/referralData.utils';

const T = REFERRAL_DATA_TEXT;

// Shared table cells + small badges for the "All referral data" tables.
// (Class-name constants live in tableClasses.js so react-refresh only sees components here.)

export const Dash = () => <span className="text-slate-300">—</span>;

const BADGE = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap';

/** User name with avatar initials; email and workspace underneath. */
export const UserCell = ({ userName, userEmail, firmName }) => (
  <div className="flex items-center gap-3 min-w-0">
    <Avatar name={userName || userEmail} size="sm" className="!rounded-lg" />
    <div className="min-w-0">
      <p className="font-semibold text-slate-800 truncate">{userName || userEmail}</p>
      <p className="text-[11px] text-slate-400 truncate">
        {userEmail}{firmName ? <> · <span className="text-slate-500">{firmName}</span></> : null}
      </p>
    </div>
  </div>
);

/** Owner name as a filter link + type badge, or "Direct". `onSelect(ownerId)` sets the owner filter. */
export const OwnerCell = ({ ownerId, ownerName, ownerType, onSelect }) => {
  if (!ownerId) return <span className="text-slate-500">{T.table.direct}</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect?.(ownerId); }}
        title={T.table.filterByOwner(ownerName)}
        className="font-medium text-blue-700 hover:underline text-left"
      >
        {ownerName}
      </button>
      <TypeBadge internal={ownerType === 'INTERNAL'} />
    </div>
  );
};

export const CodeCell = ({ code, codeLabel }) =>
  code ? (
    <div className="min-w-0">
      <CodeText code={code} className="text-xs" />
      {codeLabel && <p className="text-[11px] text-slate-400">{codeLabel}</p>}
    </div>
  ) : <Dash />;

/** "12 Oct 2026" with "4:40 PM" underneath. */
export const DateTimeCell = ({ iso }) =>
  iso ? (
    <div className="whitespace-nowrap">
      <p className="text-slate-700">{fmtDate(iso)}</p>
      <p className="text-[11px] text-slate-400">{fmtTime12(iso)}</p>
    </div>
  ) : <Dash />;

/** `onboarding.source`: At signup / Set by admin; nothing for Direct users. */
export const AttributionBadge = ({ attribution }) =>
  attribution ? (
    <span className={`${BADGE} ${attribution === 'ADMIN' ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {T.attribution[attribution] || attribution}
    </span>
  ) : <Dash />;

const EVENT_TONES = {
  SIGNUP: 'bg-slate-100 text-slate-600 border-slate-200',
  SUBSCRIPTION: 'bg-blue-50 text-blue-700 border-blue-100',
  SUBSCRIPTION_CANCELLED: 'bg-amber-50 text-amber-700 border-amber-100',
  PAYMENT: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  TOKEN_TOPUP: 'bg-violet-50 text-violet-700 border-violet-100',
  STORAGE_ADDON: 'bg-indigo-50 text-indigo-700 border-indigo-100',
};
/** Tag for a timeline event type. */
export const EventBadge = ({ type }) => (
  <span className={`${BADGE} ${EVENT_TONES[type] || EVENT_TONES.SIGNUP}`}>{T.events[type] || type}</span>
);

const STATUS_TONES = {
  ok: ['bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-emerald-500'],
  bad: ['bg-red-50 text-red-700 border-red-100', 'bg-red-500'],
  warn: ['bg-amber-50 text-amber-700 border-amber-100', 'bg-amber-500'],
  muted: ['bg-slate-100 text-slate-500 border-slate-200', 'bg-slate-400'],
};
/** Backend status strings (captured / completed / active / failed / pending / cancelled …). */
export const StatusBadge = ({ status }) => {
  if (!status) return <Dash />;
  const [cls, dot] = STATUS_TONES[statusTone(status)];
  return (
    <span className={`${BADGE} ${cls} capitalize`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {String(status).replace(/_/g, ' ')}
    </span>
  );
};
