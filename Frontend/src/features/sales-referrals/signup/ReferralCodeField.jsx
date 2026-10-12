import React from 'react';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { CODE_MAX } from '../utils/salesReferrals.utils';

const T = SALES_REFERRALS_TEXT.signupField;

/**
 * Drop-in referral field for the customer signup form. Pass the result of `useReferralCode()`.
 * Shows a small "Have a referral code?" link until opened (or until a link / remembered code opens it).
 */
const ReferralCodeField = ({ referral, id = 'referral-code', className = '' }) => {
  const { visible, show, code, status, onChange, onBlur, clear, blocksSubmit } = referral;

  if (!visible) {
    return (
      <div className={className}>
        <button type="button" onClick={show} className="text-sm text-blue-700 hover:underline">{T.toggle}</button>
      </div>
    );
  }

  const invalid = status === 'invalid' || status === 'inactive';
  const messageId = `${id}-message`;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">{T.label}</label>
        <span className="text-xs text-slate-400">{T.optional}</span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={CODE_MAX}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={T.placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={messageId}
          className={`w-full px-3 py-2 pr-9 border rounded-lg text-sm font-mono uppercase tracking-wide text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500/30 ${
            invalid ? 'border-red-400 focus:border-red-500' : status === 'valid' ? 'border-emerald-400 focus:border-emerald-500' : 'border-slate-300 focus:border-blue-500'
          }`}
        />
        {code && (
          <button type="button" onClick={clear} aria-label={T.clear} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <p id={messageId} className="mt-1 text-xs min-h-[1rem] flex items-center gap-2 flex-wrap" aria-live="polite">
        {status === 'checking' && <span className="text-slate-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{T.checking}</span>}
        {status === 'valid' && <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{T.applied}</span>}
        {invalid && (
          <>
            <span className="text-red-600 inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{status === 'inactive' ? T.inactive : T.invalid}</span>
            <button type="button" onClick={clear} className="text-red-700 font-medium hover:underline">{T.remove}</button>
          </>
        )}
      </p>
      {blocksSubmit && invalid && <p className="sr-only">{T.blocked}</p>}
    </div>
  );
};

export default ReferralCodeField;
