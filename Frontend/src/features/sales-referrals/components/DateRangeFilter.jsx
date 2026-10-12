import React from 'react';
import { CalendarDays } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { DATE_PRESETS, todayYmd } from '../utils/salesReferrals.utils';

const T = SALES_REFERRALS_TEXT.dateRange;
const DATE_INPUT = 'px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none';

/** Preset pills + optional custom from/to. State lives in the URL via useDateRangeFilter. */
const DateRangeFilter = ({ range, preset, onPreset, onRange, compact = false }) => {
  const custom = preset === 'custom';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 mr-1">
          <CalendarDays className="w-4 h-4 text-slate-400" />{T.label}
        </span>
      )}
      <div role="group" aria-label={T.label} className="flex flex-wrap items-center gap-1.5">
        {[...DATE_PRESETS, { id: 'custom', label: T.custom }].map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => (p.id === 'custom' ? onRange({ from: range.from || todayYmd(), to: range.to || todayYmd() }) : onPreset(p.id))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-slate-600">
            <span className="text-xs font-medium">{T.from}</span>
            <input type="date" value={range.from || ''} max={range.to || undefined} onChange={(e) => onRange({ ...range, from: e.target.value || null })} className={DATE_INPUT} />
          </label>
          <label className="flex items-center gap-1.5 text-slate-600">
            <span className="text-xs font-medium">{T.to}</span>
            <input type="date" value={range.to || ''} min={range.from || undefined} onChange={(e) => onRange({ ...range, to: e.target.value || null })} className={DATE_INPUT} />
          </label>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
