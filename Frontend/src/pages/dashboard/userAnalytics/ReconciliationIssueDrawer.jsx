import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, History, RefreshCw, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { fmtDateTimeIST, fmtIssueType as typeLabel } from './analyticsFormat';
import { fetchReconciliationIssue, reopenReconciliationIssue, resolveReconciliationIssue } from './analyticsApi';
import { createDebugLogger } from '../../../utils/debugLogger';

const log = createDebugLogger('ReconciliationIssueDrawer');

const SEVERITY_CLS = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  info: 'bg-slate-100 text-slate-600 border-slate-200',
};
export const SeverityPill = ({ value }) => (
  <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_CLS[value] || SEVERITY_CLS.info}`}>{value || '—'}</span>
);
export const IssueStatusPill = ({ value }) => (
  <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${value === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{value || '—'}</span>
);

const Json = ({ value, empty = 'Nothing recorded.' }) => {
  if (value == null || (typeof value === 'object' && Object.keys(value).length === 0)) return <p className="text-xs text-slate-400">{empty}</p>;
  return <pre className="text-[11px] leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 overflow-auto max-h-72 whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>;
};
const Mono = ({ children }) => (children ? <span className="font-mono text-[11px] text-slate-700 break-all">{children}</span> : <span className="text-slate-400">—</span>);

/** Right-side drawer for one reconciliation issue: context, expected vs actual, resolve / reopen with audit trail. */
const ReconciliationIssueDrawer = ({ issueId, onClose, onChanged, onToast }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reason, setReason] = useState('');
  const [formErr, setFormErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!issueId) return undefined;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchReconciliationIssue(issueId)
      .then((r) => { if (!cancelled) { setData(r.data || null); setReason(''); setFormErr(null); } })
      .catch((e) => { if (!cancelled) { setErr(e.message || 'Failed to load issue'); log.error('issue:failed', e, { summary: { issueId } }); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [issueId, reload]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const transition = async (action) => {
    const text = reason.trim();
    if (action === 'resolve' && text.length < 5) { setFormErr('Please give a reason of at least 5 characters.'); return; }
    setSaving(true);
    setFormErr(null);
    try {
      const r = action === 'resolve' ? await resolveReconciliationIssue(issueId, text) : await reopenReconciliationIssue(issueId, text || undefined);
      onToast?.('success', action === 'resolve' ? 'Issue marked resolved' : 'Issue reopened', `#${issueId}`);
      setData((d) => ({ ...(d || {}), ...(r.data || {}) }));
      setReason('');
      setReload((n) => n + 1);
      onChanged?.(r.data);
    } catch (e) {
      log.error(`issue:${action}:failed`, e, { summary: { issueId } });
      setFormErr(e.message || `Could not ${action} the issue`);
      if (e.status === 409) setReload((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  const i = data || {};
  const history = data?.history || [];
  const KV = ({ items }) => (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 min-w-0"><dt className="text-xs text-slate-500 shrink-0">{k}</dt><dd className="text-right text-slate-800 font-medium min-w-0 truncate">{v ?? '—'}</dd></div>
      ))}
    </dl>
  );
  const card = 'rounded-xl border border-slate-200 bg-white px-4 py-3';
  const h3 = 'text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2';

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="issue-title">
      <div className="absolute inset-0 bg-slate-900/40" onMouseDown={() => { if (!saving) onClose(); }} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-3xl bg-slate-50 shadow-2xl flex flex-col">
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-slate-200">
          <div className="min-w-0">
            <h2 id="issue-title" className="text-lg font-bold text-slate-800 leading-tight flex items-center gap-2 flex-wrap">
              Issue #{issueId}
              {i.issue_type && <span className="text-sm font-semibold text-slate-600">{typeLabel(i.issue_type)}</span>}
              {i.severity && <SeverityPill value={i.severity} />}
              {i.status && <IssueStatusPill value={i.status} />}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Run #{i.run_id} · created {fmtDateTimeIST(i.created_at)}. Resolving only annotates this finding; payments and Razorpay are never modified.</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setReload((n) => n + 1)} className="p-2 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Reload"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={onClose} disabled={saving} className="p-2 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50" aria-label="Close (Esc)"><X className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-5 py-4 space-y-4">
          {err ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
              <button type="button" onClick={() => setReload((n) => n + 1)} className="ml-auto text-xs font-semibold underline">Retry</button>
            </div>
          ) : loading && !data ? (
            <div className="space-y-3 animate-pulse">{[...Array(4)].map((_, k) => <div key={k} className="h-24 bg-slate-200/60 rounded-xl" />)}</div>
          ) : data && (
            <>
              <div className={card}>
                <p className="text-sm text-slate-800">{i.message}</p>
                <div className="mt-3">
                  <KV items={[
                    ['Razorpay payment ID', <Mono>{i.razorpay_payment_id}</Mono>],
                    ['Razorpay order ID', <Mono>{i.razorpay_order_id}</Mono>],
                    ['Source', i.source_table ? `${i.source_table} #${i.source_id ?? '—'}` : '—'],
                    ['User', i.user_id != null ? `#${i.user_id}` : '—'],
                    i.status === 'resolved' && ['Resolved by', i.resolved_by_email || '—'],
                    i.status === 'resolved' && ['Resolved at', fmtDateTimeIST(i.resolved_at)],
                    i.status === 'resolved' && i.resolution_reason && ['Reason', i.resolution_reason],
                  ]} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={card}><h3 className={h3}>Expected (database)</h3><Json value={i.expected} /></div>
                <div className={card}><h3 className={h3}>Actual (Razorpay)</h3><Json value={i.actual} /></div>
              </div>
              {i.details && Object.keys(i.details).length > 0 && <div className={card}><h3 className={h3}>Details</h3><Json value={i.details} /></div>}

              <div className={card}>
                <button type="button" onClick={() => setShowSnapshot((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-blue-700">
                  {showSnapshot ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Razorpay snapshot{i.razorpay_order ? ' & order' : ''}
                </button>
                {showSnapshot && (
                  <div className="mt-2 space-y-2">
                    <Json value={i.razorpay_snapshot} empty="No Razorpay payment snapshot for this issue (e.g. DB-only)." />
                    {i.razorpay_order && <><p className="text-[11px] font-semibold text-slate-500">Order</p><Json value={i.razorpay_order} /></>}
                  </div>
                )}
              </div>

              <div className={card}>
                <h3 className={h3}>{i.status === 'resolved' ? 'Reopen' : 'Resolve'}</h3>
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setFormErr(null); }}
                  rows={3}
                  placeholder={i.status === 'resolved' ? 'Why is this being reopened? (optional)' : 'Why is this acceptable or how was it fixed? (required, at least 5 characters)'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
                {formErr && <p className="mt-1.5 flex items-center gap-1 text-xs text-red-700"><AlertTriangle className="w-3.5 h-3.5" /> {formErr}</p>}
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-slate-500">Recorded with your admin email and timestamp in the audit history below.</p>
                  {i.status === 'resolved' ? (
                    <button type="button" onClick={() => transition('reopen')} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5" /> {saving ? 'Reopening…' : 'Reopen'}</button>
                  ) : (
                    <button type="button" onClick={() => transition('resolve')} disabled={saving || reason.trim().length < 5} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><ShieldCheck className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Mark resolved'}</button>
                  )}
                </div>
              </div>

              <div className={card}>
                <h3 className={`${h3} flex items-center gap-1.5`}><History className="w-3.5 h-3.5" /> Audit history</h3>
                {history.length === 0 ? <p className="text-xs text-slate-400">No history yet.</p> : (
                  <ol className="space-y-2">
                    {history.map((h, k) => (
                      <li key={h.id || k} className="flex gap-3 text-xs">
                        <span className="w-32 shrink-0 text-slate-500 tabular-nums">{fmtDateTimeIST(h.created_at)}</span>
                        <div className="min-w-0">
                          <p className="text-slate-800"><span className="font-semibold capitalize">{h.action}</span>{h.previous_status || h.new_status ? <span className="text-slate-500"> · {h.previous_status || '—'} → {h.new_status || '—'}</span> : null}{h.admin_email ? <span className="text-slate-500"> · {h.admin_email}</span> : null}</p>
                          {h.reason && <p className="text-slate-600 mt-0.5">“{h.reason}”</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default ReconciliationIssueDrawer;
