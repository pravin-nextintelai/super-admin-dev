import React from 'react';
import { Check, Loader2, Wand2 } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { useCodeAvailability } from '../hooks/useCodeAvailability';
import { CODE_MAX, normalizeCode } from '../utils/salesReferrals.utils';
import { inputClass } from './formClasses';

const T = SALES_REFERRALS_TEXT.newOwner;

/**
 * Code input with live state: Available / Checking… / error, plus a "Suggest" link.
 * Auto-uppercases, monospace. Reports its availability state to the parent via `onStateChange`.
 */
const CodeField = ({ id, value, onChange, onSuggest, suggesting = false, localError = null, touched = true, autoFocus = false, onStateChange, inputRef }) => {
  const { state, message } = useCodeAvailability(value, { localError });
  const showError = state === 'error' && touched;

  React.useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={CODE_MAX}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(normalizeCode(e.target.value))}
          placeholder={T.codePlaceholder}
          aria-invalid={showError || undefined}
          aria-describedby={`${id}-state`}
          className={`${inputClass(showError)} font-mono uppercase tracking-wide pr-20`}
        />
        <button
          type="button"
          onClick={onSuggest}
          disabled={suggesting}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
        >
          {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          {T.suggest}
        </button>
      </div>
      <p id={`${id}-state`} className="mt-1 text-xs min-h-[1rem]" aria-live="polite">
        {showError ? (
          <span className="text-red-600">{message}</span>
        ) : state === 'checking' ? (
          <span className="text-slate-400 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{T.checking}</span>
        ) : state === 'available' ? (
          <span className="text-emerald-600 inline-flex items-center gap-1"><Check className="w-3 h-3" />{T.available}</span>
        ) : null}
      </p>
    </div>
  );
};

export default CodeField;
