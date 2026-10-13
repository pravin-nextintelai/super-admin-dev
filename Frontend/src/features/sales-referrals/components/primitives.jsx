import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Info, Loader2 } from 'lucide-react';
import { SALES_REFERRALS_TEXT, SALES_REFERRALS_TOOLTIPS } from '../constants/salesReferrals.text';
import { avatarTone, initials, planStatusLabel } from '../utils/salesReferrals.utils';

const T = SALES_REFERRALS_TEXT;

// ── Buttons ───────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:hover:bg-blue-600',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100',
  link: 'text-blue-700 hover:underline px-0 py-0',
};
const BTN_SIZES = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-4 py-2.5 text-sm' };

export const Button = ({ variant = 'secondary', size = 'md', loading = false, icon: Icon, className = '', children, type = 'button', ...rest }) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${variant === 'link' ? '' : BTN_SIZES[size]} ${className}`}
    disabled={loading || rest.disabled}
    {...rest}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
    {children}
  </button>
);

export const IconButton = ({ label, icon, className = '', size = 'md', ...rest }) => {
  const Icon = icon;
  return (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${size === 'sm' ? 'p-1' : 'p-1.5'} ${className}`}
    {...rest}
  >
    <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
  </button>
  );
};

// ── Avatar + badges ───────────────────────────────────────────────────────────
export const Avatar = ({ name, size = 'md', className = '' }) => {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs';
  return (
    <span aria-hidden="true" className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${sz} ${avatarTone(name)} ${className}`}>
      {initials(name)}
    </span>
  );
};

const BADGE = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap';

export const TypeBadge = ({ internal }) => (
  <span className={`${BADGE} ${internal ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
    {internal ? T.type.internal : T.type.outsourced}
  </span>
);

export const CodeStatusBadge = ({ active }) => (
  <span className={`${BADGE} ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
    {active ? T.codeStatus.active : T.codeStatus.inactive}
  </span>
);

const PLAN_TONES = {
  FREE: 'bg-slate-100 text-slate-600 border-slate-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  LAPSED: 'bg-amber-50 text-amber-700 border-amber-100',
};
export const PlanStatusBadge = ({ status }) => (
  <span className={`${BADGE} ${PLAN_TONES[status] || PLAN_TONES.FREE}`}>{planStatusLabel(status)}</span>
);

export const LabelBadge = ({ children }) =>
  children ? <span className={`${BADGE} bg-blue-50 text-blue-700 border-blue-100 font-medium`}>{children}</span> : null;

export const NewBadge = ({ children }) => (
  <span className={`${BADGE} bg-blue-600 text-white border-blue-600 uppercase tracking-wide text-[10px]`}>{children}</span>
);

export const CodeText = ({ code, struck = false, className = '' }) => (
  <span className={`font-mono text-sm font-semibold tracking-wide ${struck ? 'line-through text-slate-400' : 'text-slate-800'} ${className}`}>{code}</span>
);

export const CodePill = ({ code }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono text-sm font-semibold tracking-wide">{code}</span>
);

// ── Mix bar + paid % ──────────────────────────────────────────────────────────
const MIX_COLORS = { free: 'bg-slate-300', paid: 'bg-emerald-500', lapsed: 'bg-amber-400' };

/** Stacked Free / Paid / Lapsed bar with a compact legend. */
export const MixBar = ({ free = 0, paid = 0, lapsed = 0, legend = true, className = '' }) => {
  const total = free + paid + lapsed;
  const w = (n) => (total ? `${(n / total) * 100}%` : '0%');
  return (
    <div className={`min-w-[120px] ${className}`} title={SALES_REFERRALS_TOOLTIPS.mix}>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex" role="img" aria-label={`${free} free, ${paid} paid, ${lapsed} lapsed`}>
        {total > 0 && (
          <>
            <span className={`${MIX_COLORS.free} h-full`} style={{ width: w(free) }} />
            <span className={`${MIX_COLORS.paid} h-full`} style={{ width: w(paid) }} />
            <span className={`${MIX_COLORS.lapsed} h-full`} style={{ width: w(lapsed) }} />
          </>
        )}
      </div>
      {legend && (
        <div className="flex gap-2.5 mt-1 text-[10px] text-slate-500 whitespace-nowrap">
          <span className="inline-flex items-center gap-1"><i className={`w-1.5 h-1.5 rounded-full ${MIX_COLORS.free}`} />{T.planStatus.FREE} {free}</span>
          <span className="inline-flex items-center gap-1"><i className={`w-1.5 h-1.5 rounded-full ${MIX_COLORS.paid}`} />{T.planStatus.PAID} {paid}</span>
          <span className="inline-flex items-center gap-1"><i className={`w-1.5 h-1.5 rounded-full ${MIX_COLORS.lapsed}`} />{T.planStatus.LAPSED} {lapsed}</span>
        </div>
      )}
    </div>
  );
};

export const PaidPctBar = ({ value = 0 }) => (
  <div className="flex items-center gap-2 min-w-[90px]" title={SALES_REFERRALS_TOOLTIPS.paidPct}>
    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
    <span className="text-sm font-semibold text-slate-700 tabular-nums w-9 text-right">{value}%</span>
  </div>
);

// ── Form bits ─────────────────────────────────────────────────────────────────
export const Field = ({ id, label, required, optional, hint, error, children, className = '' }) => (
  <div className={className}>
    <div className="flex items-baseline justify-between gap-2 mb-1">
      <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {optional && <span className="text-[11px] text-slate-400">{T.signupField.optional}</span>}
    </div>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    ) : null}
  </div>
);

/** `typeBadge` shows the Internal / Outsourced badge next to the label (owner forms); off for plain toggles. */
export const Switch = ({ id, checked, onChange, label, description, typeBadge = true, className = '' }) => (
  <div className={`flex items-start gap-3 ${className}`}>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors mt-0.5 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2">
        {label}
        {typeBadge && <TypeBadge internal={checked} />}
      </label>
      {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
    </div>
  </div>
);

export const SegmentedControl = ({ options, value, onChange, label }) => (
  <div role="group" aria-label={label} className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export const Callout = ({ tone = 'info', children }) => {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  const cls = tone === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-100 text-blue-800';
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${cls}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

// ── Page-level states ─────────────────────────────────────────────────────────
export const Breadcrumb = ({ items }) => (
  <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500 flex-wrap">
    {items.map((item, i) => (
      <React.Fragment key={`${item.label}-${i}`}>
        {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />}
        {item.to ? (
          <Link to={item.to} className="hover:text-blue-700 hover:underline">{item.label}</Link>
        ) : (
          <span className="text-slate-800 font-medium" aria-current="page">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

export const SkeletonBlock = ({ className = '' }) => <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;

const SKELETON_GRID = { 4: 'grid-cols-2 md:grid-cols-4', 6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' };
export const PageSkeleton = ({ cards = 6 }) => (
  <div className="space-y-5 animate-pulse" aria-busy="true" aria-label={T.common.loading}>
    <div className={`grid ${SKELETON_GRID[cards] || SKELETON_GRID[6]} gap-3`}>
      {Array.from({ length: cards }).map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
    </div>
    <SkeletonBlock className="h-14" />
    <SkeletonBlock className="h-72" />
  </div>
);

export const ErrorState = ({ title = T.common.somethingWrong, message, onRetry }) => (
  <div className="bg-white border border-red-200 rounded-xl p-8 flex flex-col items-center text-center gap-2" role="alert">
    <AlertTriangle className="w-8 h-8 text-red-500" />
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    {message && <p className="text-sm text-slate-500 max-w-md">{message}</p>}
    {onRetry && <Button variant="primary" onClick={onRetry} className="mt-2">{T.common.retry}</Button>}
  </div>
);

export const EmptyState = ({ icon: Icon, title, body, action }) => (
  <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center text-center gap-2">
    {Icon && <span className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-1"><Icon className="w-6 h-6" /></span>}
    <p className="text-base font-semibold text-slate-800">{title}</p>
    {body && <p className="text-sm text-slate-500 max-w-md">{body}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const Spinner = ({ className = '' }) => <Loader2 className={`w-4 h-4 animate-spin ${className}`} aria-hidden="true" />;
