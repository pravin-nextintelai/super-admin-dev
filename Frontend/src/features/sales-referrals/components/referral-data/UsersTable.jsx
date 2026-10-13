import React from 'react';
import { ChevronRight } from 'lucide-react';
import { REFERRAL_DATA_TEXT } from '../../constants/referralData.text';
import { fmtDate, fmtNum } from '../../utils/salesReferrals.utils';
import { accountTypeLabel, fmtInr } from '../../utils/referralData.utils';
import { PlanStatusBadge } from '../primitives';
import { AttributionBadge, CodeCell, Dash, DateTimeCell, OwnerCell, UserCell } from './cells';
import { TABLE_MIN, TD, TH } from './tableClasses';
import UserDetail from './UserDetail';

const T = REFERRAL_DATA_TEXT.table;
const COLS = 11;
const detailId = (id) => `referral-data-detail-${id}`;

/**
 * "By user" table. A row click (or its chevron) expands the subscription history inline.
 * `expanded`: Set<userId>; `histories`: { [userId]: { status, data?, error? } }.
 */
const UsersTable = ({ rows, expanded, histories, onToggle, onSelectOwner, onRetryHistory, onDownloadHistory, downloadingId, detailWidth }) => (
  <table className={`w-full text-sm ${TABLE_MIN}`}>
    <thead className="bg-slate-50">
      <tr>
        <th scope="col" className={`${TH} w-10`}><span className="sr-only">{T.expandColumn}</span></th>
        <th scope="col" className={TH}>{T.user}</th>
        <th scope="col" className={TH}>{T.owner}</th>
        <th scope="col" className={TH}>{T.code}</th>
        <th scope="col" className={TH} aria-sort="descending">{T.onboarded}</th>
        <th scope="col" className={TH}>{T.attribution}</th>
        <th scope="col" className={TH}>{T.currentPlan}</th>
        <th scope="col" className={`${TH} text-right`}>{T.payments}</th>
        <th scope="col" className={`${TH} text-right`}>{T.totalPaid}</th>
        <th scope="col" className={TH}>{T.lastPayment}</th>
        <th scope="col" className={TH}>{T.account}</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {rows.map((r) => {
        const open = expanded.has(r.userId);
        const until = r.currentSubscription?.endDate && !r.currentSubscription.isExpired ? T.until(fmtDate(r.currentSubscription.endDate)) : null;
        return (
          <React.Fragment key={r.userId}>
            <tr onClick={() => onToggle(r.userId)} className={`cursor-pointer transition-colors ${open ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
              <td className={`${TD} pr-0`}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggle(r.userId); }}
                  aria-expanded={open}
                  aria-controls={detailId(r.userId)}
                  aria-label={open ? T.collapse(r.userName) : T.expand(r.userName)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                >
                  <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>
              </td>
              <td className={TD}><UserCell userName={r.userName} userEmail={r.userEmail} firmName={r.firmName} /></td>
              <td className={TD}><OwnerCell ownerId={r.ownerId} ownerName={r.ownerName} ownerType={r.ownerType} onSelect={onSelectOwner} /></td>
              <td className={TD}><CodeCell code={r.code} codeLabel={r.codeLabel} /></td>
              <td className={TD}><DateTimeCell iso={r.signedUpAt} /></td>
              <td className={TD}><AttributionBadge attribution={r.attribution} /></td>
              <td className={TD}>
                <div className="flex flex-col items-start gap-1">
                  <PlanStatusBadge status={r.planStatus} />
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {r.currentPlanName || T.noPlan}{until && ` · ${until}`}
                  </span>
                </div>
              </td>
              <td className={`${TD} text-right tabular-nums text-slate-700`}>{fmtNum(r.purchaseCount)}</td>
              <td className={`${TD} text-right tabular-nums font-semibold text-slate-800`}>{r.totalPaidInr ? fmtInr(r.totalPaidInr) : <Dash />}</td>
              <td className={`${TD} text-slate-700 whitespace-nowrap`}>{r.lastPurchaseAt ? fmtDate(r.lastPurchaseAt) : <Dash />}</td>
              <td className={`${TD} whitespace-nowrap`}>
                <span className="text-slate-700">{accountTypeLabel(r.accountType) || <Dash />}</span>
                {r.isBlocked ? <span className="block text-[11px] text-red-600">{T.blocked}</span> : !r.isActive ? <span className="block text-[11px] text-amber-600">{T.inactive}</span> : null}
              </td>
            </tr>
            {open && (
              <tr id={detailId(r.userId)} className="bg-slate-50/70">
                <td colSpan={COLS} className="p-0">
                  {/* Sticky + sized to the scroll container so the cards fit the visible width while the table scrolls. */}
                  <div className="sticky left-0 px-4 py-4" style={detailWidth ? { width: detailWidth } : undefined}>
                    <UserDetail
                      row={r}
                      history={histories[r.userId]}
                      onRetryHistory={onRetryHistory}
                      onDownloadHistory={onDownloadHistory}
                      downloading={downloadingId === r.userId}
                    />
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </tbody>
  </table>
);

export default UsersTable;
