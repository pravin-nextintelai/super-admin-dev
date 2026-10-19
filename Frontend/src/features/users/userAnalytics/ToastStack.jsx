import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const KIND = {
  success: { icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', iconCls: 'text-emerald-600' },
  error: { icon: XCircle, cls: 'border-red-200 bg-red-50 text-red-800', iconCls: 'text-red-600' },
  warning: { icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50 text-amber-800', iconCls: 'text-amber-600' },
  info: { icon: Info, cls: 'border-blue-200 bg-blue-50 text-blue-800', iconCls: 'text-blue-600' },
};

/** Fixed bottom-right stack of inline toasts produced by useToasts(). */
const ToastStack = ({ toasts, onDismiss }) => {
  if (!toasts?.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[22rem] max-w-[calc(100vw-2rem)]" aria-live="polite">
      {toasts.map((t) => {
        const k = KIND[t.kind] || KIND.info;
        const Icon = k.icon;
        return (
          <div key={t.id} role="status" className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-lg text-sm ${k.cls}`}>
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${k.iconCls}`} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{t.title}</p>
              {t.text && <p className="text-xs mt-0.5 opacity-90 break-words">{t.text}</p>}
            </div>
            <button type="button" onClick={() => onDismiss(t.id)} className="p-0.5 rounded opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastStack;
