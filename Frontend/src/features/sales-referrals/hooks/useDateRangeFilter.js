import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DATE_PRESETS, EMPTY_RANGE } from '../utils/salesReferrals.utils';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v) => (v && YMD.test(v) ? v : null);

/**
 * Signup date range kept in the URL (`?from=&to=`) so it survives navigation between the
 * overview, owner and signups pages. Default: All time.
 */
export const useDateRangeFilter = () => {
  const [params, setParams] = useSearchParams();
  const range = useMemo(() => ({ from: clean(params.get('from')), to: clean(params.get('to')) }), [params]);
  const preset = useMemo(() => {
    if (!range.from && !range.to) return 'all';
    const hit = DATE_PRESETS.find((p) => {
      const r = p.range();
      return r.from === range.from && r.to === range.to;
    });
    return hit ? hit.id : 'custom';
  }, [range]);

  const setRange = useCallback((next) => {
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      if (next?.from) out.set('from', next.from); else out.delete('from');
      if (next?.to) out.set('to', next.to); else out.delete('to');
      return out;
    }, { replace: true });
  }, [setParams]);

  const applyPreset = useCallback((id) => {
    const p = DATE_PRESETS.find((x) => x.id === id);
    setRange(p ? p.range() : EMPTY_RANGE);
  }, [setRange]);

  const search = params.toString();
  return { range, preset, setRange, applyPreset, search: search ? `?${search}` : '' };
};
