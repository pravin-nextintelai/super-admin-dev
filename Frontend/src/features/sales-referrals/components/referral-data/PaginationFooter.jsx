import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { REFERRAL_DATA_TEXT } from '../../constants/referralData.text';
import { fmtNum } from '../../utils/salesReferrals.utils';
import { Button } from '../primitives';

const T = REFERRAL_DATA_TEXT.table;

/**
 * "Showing a–b of n" + Previous / Next. `data` is any paged response ({ page, size, totalItems, totalPages }).
 * `eventsOnPage` switches to the Payments-tab wording (pages are users, rows are their payments).
 */
const PaginationFooter = ({ data, onPage, disabled = false, eventsOnPage }) => {
  if (!data) return null;
  const first = data.totalItems ? (data.page - 1) * data.size + 1 : 0;
  const last = Math.min(data.page * data.size, data.totalItems);
  const label = !data.totalItems
    ? T.showingNone
    : eventsOnPage === undefined
      ? T.showing(fmtNum(first), fmtNum(last), fmtNum(data.totalItems))
      : T.showingUsers(fmtNum(first), fmtNum(last), fmtNum(data.totalItems), eventsOnPage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
      <p className="text-xs text-slate-500 tabular-nums">{label}</p>
      <div className="flex items-center gap-2">
        <Button size="sm" icon={ChevronLeft} onClick={() => onPage(data.page - 1)} disabled={disabled || data.page <= 1}>{T.prev}</Button>
        <Button size="sm" onClick={() => onPage(data.page + 1)} disabled={disabled || data.page >= data.totalPages} className="flex-row-reverse">
          <ChevronRight className="w-4 h-4" />{T.next}
        </Button>
      </div>
    </div>
  );
};

export default PaginationFooter;
