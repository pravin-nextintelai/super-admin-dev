import React, { useRef } from 'react';
import { fmtNum } from '../../utils/salesReferrals.utils';
import { panelId, tabId } from '../../utils/referralData.utils';

/**
 * Accessible tab strip (role=tablist / tab, aria-selected, arrow-key navigation).
 * `tabs: { id, label, icon?, count? }[]`. Panels should use `id={panelId(id)}` + `aria-labelledby={tabId(id)}`.
 */

const Tabs = ({ tabs, value, onChange, label }) => {
  const refs = useRef({});
  const onKeyDown = (e, index) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-1">
      {tabs.map((t, i) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId(t.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
            {t.label}
            {t.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{fmtNum(t.count)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
