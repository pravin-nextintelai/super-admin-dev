import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' };

/**
 * Centered modal dialog: traps focus, closes on Escape / backdrop click, restores focus on close,
 * and fits on mobile (full width, scrollable body). Rendered through a portal on <body> so it
 * always sits above the fixed sidebar regardless of where it is mounted.
 */
const Dialog = ({ open, onClose, title, subtitle, size = 'md', children, footer, initialFocusRef, closeDisabled = false, titleId: titleIdProp }) => {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const generatedId = React.useId();
  const titleId = titleIdProp || `dlg-title-${generatedId}`;

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    const focusFirst = () => {
      if (initialFocusRef?.current) initialFocusRef.current.focus();
      else panel?.querySelector(FOCUSABLE)?.focus();
    };
    const timer = setTimeout(focusFirst, 0);

    const onKey = (e) => {
      if (e.key === 'Escape' && !closeDisabled) { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, closeDisabled, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-slate-900/50" onClick={closeDisabled ? undefined : onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${SIZES[size]} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-fadeIn`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={SALES_REFERRALS_TEXT.common.close}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default Dialog;
