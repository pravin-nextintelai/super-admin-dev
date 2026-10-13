import React, { useMemo } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { REFERRAL_DATA_TEXT } from '../../constants/referralData.text';
import { PLAN_STATUS_FILTER } from '../../types/referralData.types';
import { OWNER_TYPE_FILTER } from '../../types/salesReferrals.types';
import { fmtNum } from '../../utils/salesReferrals.utils';
import DateRangeFilter from '../DateRangeFilter';
import { Button, IconButton, SegmentedControl, Switch } from '../primitives';
import { inputClass } from '../formClasses';

const T = REFERRAL_DATA_TEXT.filters;

const TYPE_OPTIONS = [
  { value: OWNER_TYPE_FILTER.ALL, label: T.typeAll },
  { value: OWNER_TYPE_FILTER.INTERNAL, label: T.typeInternal },
  { value: OWNER_TYPE_FILTER.OUTSOURCED, label: T.typeOutsourced },
];
const STATUS_OPTIONS = [
  { value: PLAN_STATUS_FILTER.ALL, label: T.statusAll, countKey: 'all' },
  { value: PLAN_STATUS_FILTER.FREE, label: T.statusFree, countKey: 'free' },
  { value: PLAN_STATUS_FILTER.PAID, label: T.statusPaid, countKey: 'paid' },
  { value: PLAN_STATUS_FILTER.LAPSED, label: T.statusLapsed, countKey: 'lapsed' },
];

const SELECT = `${inputClass(false)} !w-auto min-w-[160px] max-w-[260px] pr-8 py-1.5`;

/**
 * Filter card for the "All referral data" page plus the removable active-filter chips under it.
 * `filters` holds everything except the date range, which lives in the URL (useDateRangeFilter).
 */
const ReferralDataFilterBar = ({
  range, preset, onPreset, onRange,
  owners, filters, statusCounts, searchInput, chips,
  onChange, onSearchInput, onRemoveChip, onClearAll,
}) => {
  const codeOptions = useMemo(() => {
    const list = filters.ownerId ? owners.filter((o) => o.id === filters.ownerId) : owners;
    return list.flatMap((o) => o.codes.map((c) => ({ ...c, ownerName: o.name })));
  }, [owners, filters.ownerId]);

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter range={range} preset={preset} onPreset={onPreset} onRange={onRange} />
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder={T.searchPlaceholder}
              aria-label={T.searchPlaceholder}
              className={`${inputClass(false)} pl-9 pr-8`}
            />
            {searchInput && <IconButton size="sm" label="Clear search" icon={X} onClick={() => onSearchInput('')} className="absolute right-1.5 top-1/2 -translate-y-1/2" />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label={T.owner}
            value={filters.ownerId || ''}
            onChange={(e) => onChange({ ownerId: e.target.value || undefined, code: undefined })}
            className={SELECT}
          >
            <option value="">{T.allOwners}</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          <select
            aria-label={T.code}
            value={filters.code || ''}
            onChange={(e) => onChange({ code: e.target.value || undefined })}
            className={SELECT}
          >
            <option value="">{T.allCodes}</option>
            {codeOptions.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}{c.label ? ` · ${c.label}` : ''}{filters.ownerId ? '' : ` · ${c.ownerName}`}{c.active ? '' : ` ${T.inactiveSuffix}`}
              </option>
            ))}
          </select>

          <SegmentedControl options={TYPE_OPTIONS} value={filters.ownerType} onChange={(v) => onChange({ ownerType: v })} label={T.ownerType} />

          <div role="group" aria-label={T.planStatus} className="flex flex-wrap items-center gap-1.5">
            {STATUS_OPTIONS.map((o) => {
              const active = filters.planStatus === o.value;
              const n = statusCounts ? statusCounts[o.countKey] : undefined;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ planStatus: o.value })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {o.label}{n !== undefined && <span className={`ml-1.5 tabular-nums ${active ? 'text-slate-300' : 'text-slate-400'}`}>{fmtNum(n)}</span>}
                </button>
              );
            })}
          </div>

          <Switch
            id="referral-data-include-direct"
            checked={filters.includeDirect}
            onChange={(v) => onChange({ includeDirect: v })}
            label={T.includeDirect}
            typeBadge={false}
            className="ml-auto"
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-100 font-medium">
              {c.label}
              <button
                type="button"
                onClick={() => onRemoveChip(c.key)}
                aria-label={T.removeFilter(c.label)}
                className="p-0.5 rounded-full text-blue-500 hover:text-blue-800 hover:bg-blue-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <Button variant="link" onClick={onClearAll} className="text-xs">{T.clearAll}</Button>
        </div>
      )}
    </div>
  );
};

export default ReferralDataFilterBar;
