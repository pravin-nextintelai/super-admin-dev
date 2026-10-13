import React from 'react';
import { REFERRAL_DATA_TEXT } from '../../constants/referralData.text';
import { fmtInr } from '../../utils/referralData.utils';
import { CodeCell, DateTimeCell, EventBadge, OwnerCell, StatusBadge, UserCell } from './cells';
import { TABLE_MIN, TD, TH } from './tableClasses';

const T = REFERRAL_DATA_TEXT.table;

/** "Payments" tab: one row per captured subscription payment (timeline PAYMENT events), newest first. */
const PaymentsTable = ({ rows, onSelectOwner }) => (
  <table className={`w-full text-sm ${TABLE_MIN}`}>
    <thead className="bg-slate-50">
      <tr>
        <th scope="col" className={TH} aria-sort="descending">{T.date}</th>
        <th scope="col" className={TH}>{T.user}</th>
        <th scope="col" className={TH}>{T.owner}</th>
        <th scope="col" className={TH}>{T.code}</th>
        <th scope="col" className={TH}>{T.event}</th>
        <th scope="col" className={TH}>{T.detail}</th>
        <th scope="col" className={`${TH} text-right`}>{T.amount}</th>
        <th scope="col" className={TH}>{T.status}</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {rows.length === 0 ? (
        <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-500">{T.emptyPayments}</td></tr>
      ) : rows.map((e) => (
        <tr key={`${e.user.userId}-${e.id}`} className="hover:bg-slate-50">
          <td className={TD}><DateTimeCell iso={e.occurredAt} /></td>
          <td className={TD}><UserCell userName={e.user.userName} userEmail={e.user.userEmail} firmName={e.user.firmName} /></td>
          <td className={TD}><OwnerCell ownerId={e.user.ownerId} ownerName={e.user.ownerName} ownerType={e.user.ownerType} onSelect={onSelectOwner} /></td>
          <td className={TD}><CodeCell code={e.user.code} codeLabel={e.user.codeLabel} /></td>
          <td className={TD}>
            <div className="flex flex-col items-start gap-1">
              <EventBadge type={e.type} />
              <span className="text-[11px] text-slate-500">{e.title}</span>
            </div>
          </td>
          <td className={`${TD} text-slate-700`}>{e.detail ? <span className="font-mono text-xs">{e.detail}</span> : <span className="text-slate-300">—</span>}</td>
          <td className={`${TD} text-right tabular-nums font-semibold text-slate-800`}>{e.amountInr !== null ? fmtInr(e.amountInr) : <span className="text-slate-300">—</span>}</td>
          <td className={TD}><StatusBadge status={e.status} /></td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default PaymentsTable;
